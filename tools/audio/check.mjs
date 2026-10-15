// Listens to every generated line with ElevenLabs speech-to-text (Scribe) and
// compares it with the text it should say (docs/SOUND_PLAN.md):
//   - words: word error rate against the line's text;
//   - tags read aloud: a performance tag such as "[giggles]" spoken as a word;
//   - events: sounds Scribe heard, e.g. "[laughs]", so a tag that worked shows.
// Transcripts are cached next to each take (transcript-N.json), so a take is
// only sent once. Results go to art/source/audio/checks.json for the review page.
//
//   node tools/audio/check.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, eleven } from './eleven.mjs';

const OUT = resolve(ROOT, 'art/source/audio');
const cues = JSON.parse(readFileSync(resolve(ROOT, 'audio/cues.json'), 'utf8'));
const MAX_WER = 0.25;

const words = (s) =>
  s
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

function wer(expected, heard) {
  const a = words(expected);
  const b = words(heard);
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return a.length ? d[a.length][b.length] / a.length : 0;
}

async function transcribe(file, lang) {
  const cache = file.replace(/take-(\d+)\.mp3$/, 'transcript-$1.json');
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'));
  const form = new FormData();
  form.set('model_id', 'scribe_v2');
  form.set('tag_audio_events', 'true');
  form.set('language_code', lang);
  form.set('file', new Blob([readFileSync(file)], { type: 'audio/mpeg' }), 'take.mp3');
  const r = await eleven('/v1/speech-to-text', { method: 'POST', body: form });
  const result = { text: r.text, language: r.language_code };
  writeFileSync(cache, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const results = {};
let flagged = 0;
for (const l of cues.lines ?? []) {
  for (const model of l.models ?? cues.lineDefaults.models) {
    const dir = join(OUT, 'lines', l.id, model);
    if (!existsSync(join(dir, 'cue.json'))) continue;
    const rec = JSON.parse(readFileSync(join(dir, 'cue.json'), 'utf8'));
    for (const take of rec.takes) {
      const t = await transcribe(join(dir, take.file), l.lang);
      const tags = [...(l.say ?? '').matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].toLowerCase());
      const heardWords = words(t.text).join(' ');
      const readAloud = tags.filter((tag) => heardWords.includes(tag.split(' ').at(-1)));
      // Scribe marks sounds in brackets: "[śmiech]", "[laughs]", "(giggles)".
      const events = [...t.text.matchAll(/\[([^\]]+)\]|\(([^)]+)\)/g)].map((m) => m[1] ?? m[2]);
      const w = Math.round(wer(l.text, t.text) * 100) / 100;
      const ok = w <= MAX_WER && !readAloud.length;
      if (!ok) flagged++;
      results[`${l.id}/${model}/${take.file}`] = { heard: t.text, wer: w, readAloud, events, ok, seconds: take.seconds };
      console.log(`${ok ? '✓' : '✗'} ${l.id} ${model} ${take.file}  wer ${w}${readAloud.length ? `  READ ALOUD: ${readAloud}` : ''}${events.length ? `  events: ${events}` : ''}  «${t.text}»`);
    }
  }
}
writeFileSync(join(OUT, 'checks.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(`\n${Object.keys(results).length} takes checked, ${flagged} flagged.`);
