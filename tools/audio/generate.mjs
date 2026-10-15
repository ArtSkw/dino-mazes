// Generates the missing or changed cues of audio/cues.json with ElevenLabs
// (docs/SOUND_PLAN.md) into art/source/audio/ (local, never committed):
//
//   effects/<id>/take-N.mp3              POST /v1/sound-generation
//   music/<id>/take-N.mp3                POST /v1/music (composition plan)
//   voices/<id>/preview-N.mp3            POST /v1/text-to-voice/design; the
//                                        picked preview (`pick`, default 1) is
//                                        saved to the account (voices.json)
//   lines/<id>/<model>/take-N.mp3        POST /v1/text-to-speech/<voice>
//
// Each folder keeps cue.json with the request's hash: an unchanged cue is
// skipped, a changed one is made again, so runs never pay twice.
//
//   node tools/audio/generate.mjs [--only=tap,tiny-] [--voices=bill,giganto] [--dry]
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, eleven } from './eleven.mjs';

const OUT = resolve(ROOT, 'art/source/audio');
const FORMAT = 'mp3_44100_128';
const cues = JSON.parse(readFileSync(resolve(ROOT, 'audio/cues.json'), 'utf8'));
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const dry = args.includes('--dry');
const wanted = (id) => !only || only.some((o) => id.startsWith(o));

const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 12);
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const writeJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

let failures = 0;
let made = 0;

/** Make takes until `count` exist for this exact request. */
async function takes(dir, request, count, make) {
  const h = hash(request);
  const rec = readJson(join(dir, 'cue.json'), null);
  const list = rec?.hash === h ? rec.takes : [];
  if (list.length >= count) return;
  if (dry) {
    console.log(`would make ${count - list.length} × ${dir.slice(OUT.length + 1)}`);
    return;
  }
  mkdirSync(dir, { recursive: true });
  for (let i = list.length; i < count; i++) {
    const file = `take-${i + 1}.mp3`;
    writeFileSync(join(dir, file), await make(i));
    list.push({ file, seconds: Math.round(duration(join(dir, file)) * 100) / 100 });
    writeJson(join(dir, 'cue.json'), { hash: h, request, takes: list });
    made++;
    console.log(`  ${dir.slice(OUT.length + 1)}/${file}`);
  }
}

async function guarded(label, fn) {
  try {
    await fn();
  } catch (err) {
    failures++;
    console.error(`✗ ${label}: ${err.message}`);
  }
}

async function effects() {
  for (const e of cues.effects ?? []) {
    if (!wanted(e.id)) continue;
    // `style` names an extra sentence (e.g. "gentle", owner round 2) added after the palette.
    // `plain` cues (real field recordings) skip the cartoon palette.
    const text = e.plain ? e.prompt : `${e.prompt} ${cues.palette}${e.style ? ` ${cues[e.style]}` : ''}`;
    const request = { text, duration_seconds: e.seconds, prompt_influence: e.influence, model_id: 'eleven_text_to_sound_v2', ...(e.loop ? { loop: true } : {}) };
    await guarded(e.id, () => takes(join(OUT, 'effects', e.id), request, e.takes, () => eleven('/v1/sound-generation', { method: 'POST', body: request, query: { output_format: FORMAT } })));
  }
}

async function music() {
  for (const m of cues.music ?? []) {
    if (!wanted(m.id)) continue;
    const request = {
      model_id: m.model,
      composition_plan: { chunks: m.chunks.map((c) => ({ text: c.text, duration_ms: c.ms, positive_styles: c.styles, negative_styles: c.avoid })) },
    };
    await guarded(m.id, () => takes(join(OUT, 'music', m.id), request, m.takes, () => eleven('/v1/music', { method: 'POST', body: request, query: { output_format: FORMAT } })));
  }
}

/**
 * Delete a voice this tool saved (only "Dino Mazes …" voices). A key without
 * the voices_write permission cannot: the voice stays, with a note to delete
 * it by hand, and generation goes on.
 */
async function removeVoice(voiceId, name) {
  try {
    const info = await eleven(`/v1/voices/${voiceId}`).catch(() => null);
    if (info && !info.name?.startsWith('Dino Mazes')) return false;
    if (info) await eleven(`/v1/voices/${voiceId}`, { method: 'DELETE' });
    console.log(`  deleted ${name}`);
    return true;
  } catch (err) {
    console.warn(`! could not delete ${name} (${/voices_write/.test(err.message) ? 'the key lacks voices_write' : err.message}); delete it in ElevenLabs › Voices`);
    return false;
  }
}

/** Design each voice (three previews) and save the picked preview to the account. */
async function voices() {
  const savedFile = join(OUT, 'voices.json');
  const saved = readJson(savedFile, {});
  for (const v of cues.voices ?? []) {
    if (!wanted(v.id)) continue;
    await guarded(v.id, async () => {
      const dir = join(OUT, 'voices', v.id);
      const request = { voice_description: v.description, text: v.text, model_id: 'eleven_ttv_v3', seed: v.seed };
      const h = hash(request);
      let rec = readJson(join(dir, 'cue.json'), null);
      if (rec?.hash !== h) {
        if (dry) return console.log(`would design voice ${v.id}`);
        const res = await eleven('/v1/text-to-voice/design', { method: 'POST', body: request, query: { output_format: FORMAT } });
        mkdirSync(dir, { recursive: true });
        const previews = res.previews.map((p, i) => {
          const file = `preview-${i + 1}.mp3`;
          writeFileSync(join(dir, file), Buffer.from(p.audio_base_64, 'base64'));
          return { file, generated_voice_id: p.generated_voice_id, seconds: Math.round(p.duration_secs * 100) / 100, language: p.language };
        });
        rec = { hash: h, request, previews };
        writeJson(join(dir, 'cue.json'), rec);
        made += previews.length;
        console.log(`  voices/${v.id}: ${previews.length} previews`);
      }
      const pick = v.pick ?? 1;
      const generated = rec.previews[pick - 1]?.generated_voice_id;
      if (!generated) throw new Error(`no preview ${pick}`);
      if (saved[v.id]?.generated_voice_id === generated) return;
      if (dry) return console.log(`would save voice ${v.id} (preview ${pick})`);
      // A different pick replaces the voice this tool saved before (frees its slot).
      const old = saved[v.id]?.voice_id;
      if (old) await removeVoice(old, saved[v.id].name);
      const res = await eleven('/v1/text-to-voice', { method: 'POST', body: { voice_name: v.name, voice_description: v.description, generated_voice_id: generated } });
      saved[v.id] = { voice_id: res.voice_id, generated_voice_id: generated, pick, name: v.name };
      writeJson(savedFile, saved);
      console.log(`  saved ${v.name} (preview ${pick})`);
    });
  }
  // Voices this tool saved that are no longer cast (e.g. separate English voices) free their slots.
  if (!only) {
    for (const [id, v] of Object.entries(saved)) {
      if ((cues.voices ?? []).some((c) => c.id === id)) continue;
      if (dry) {
        console.log(`would delete voice ${v.name}`);
        continue;
      }
      if (await removeVoice(v.voice_id, v.name)) {
        delete saved[id];
        writeJson(savedFile, saved);
      }
    }
  }
  return saved;
}

/** One line in one model; eleven_v4 falls back to the dialogue endpoint if plain speech refuses it. */
async function speak(voiceId, model, text, lang, seed) {
  const body = { text, model_id: model, language_code: lang, seed };
  try {
    return await eleven(`/v1/text-to-speech/${voiceId}`, { method: 'POST', body, query: { output_format: FORMAT } });
  } catch (err) {
    if (!model.startsWith('eleven_v4') || !/\b(400|422)\b/.test(err.message)) throw err;
    return eleven('/v1/text-to-dialogue', { method: 'POST', body: { inputs: [{ text, voice_id: voiceId }], model_id: model, language_code: lang, seed }, query: { output_format: FORMAT } });
  }
}

// All lines: the hand-written ones in cues.json plus every game text (audio/lines.json, tools/audio/lines.mjs).
const gameLines = readJson(resolve(ROOT, 'audio/lines.json'), { lines: [] }).lines.map((l) => ({ ...l, say: cues.say?.[l.id], bulk: true }));
const voicesOnly = args.find((a) => a.startsWith('--voices='))?.slice(9).split(',');
const checks = readJson(join(OUT, 'checks.json'), {});

async function lines(saved) {
  const d = cues.lineDefaults ?? { models: ['eleven_v3'], takes: 1 };
  for (const l of [...(cues.lines ?? []), ...gameLines]) {
    if (!wanted(l.id) || (voicesOnly && !voicesOnly.includes(l.voice))) continue;
    const voice = saved[l.voice];
    if (!voice) {
      if (!dry) console.error(`✗ ${l.id}: voice ${l.voice} is not saved yet`);
      else console.log(`would speak ${l.id} after ${l.voice} is saved`);
      continue;
    }
    for (const model of l.models ?? d.models) {
      const request = { text: l.say ?? l.text, model, lang: l.lang, voice: voice.voice_id };
      // Game lines start with one take; each take the Scribe check flagged earns another (up to three).
      const dir = join(OUT, 'lines', l.id, model);
      const flagged = Object.entries(checks).filter(([k, c]) => k.startsWith(`${l.id}/${model}/`) && !c.ok).length;
      const count = l.bulk ? Math.min(3, (cues.bulkTakes ?? 1) + flagged) : (l.takes ?? d.takes);
      await guarded(`${l.id} ${model}`, () => takes(dir, request, count, (i) => speak(voice.voice_id, model, request.text, l.lang, 1 + i)));
    }
  }
}

const credits = async () => (await eleven('/v1/user/subscription')).character_count;
const before = dry ? 0 : await credits();
await effects();
await music();
const saved = await voices();
await lines(saved);
if (!dry) {
  const after = await credits();
  console.log(`\n${made} new files, ${after - before} credits used${failures ? `, ${failures} failed` : ''}.`);
}
process.exitCode = failures ? 1 : 0;
