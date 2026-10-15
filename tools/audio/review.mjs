// Builds the listening page for the generated audio (docs/SOUND_PLAN.md):
// art/source/audio/review/index.html (local, never committed). Every take is
// loudness-matched first (effects −16 LUFS, voices and music −19), so takes
// are compared by sound, not by volume. The owner stars favourites and copies
// the picks back to Claude. Labels are in Polish, for the owner.
//
// Cues with a `pick` in audio/cues.json are already chosen and left out
// (--all shows everything).
//
//   node tools/audio/review.mjs [--all] && open art/source/audio/review/index.html
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT } from './eleven.mjs';
import { normalize } from './loudness.mjs';

const SRC = resolve(ROOT, 'art/source/audio');
const OUT = join(SRC, 'review');
const cues = JSON.parse(readFileSync(resolve(ROOT, 'audio/cues.json'), 'utf8'));
const checks = existsSync(join(SRC, 'checks.json')) ? JSON.parse(readFileSync(join(SRC, 'checks.json'), 'utf8')) : {};
const saved = existsSync(join(SRC, 'voices.json')) ? JSON.parse(readFileSync(join(SRC, 'voices.json'), 'utf8')) : {};
const rec = (dir) => (existsSync(join(dir, 'cue.json')) ? JSON.parse(readFileSync(join(dir, 'cue.json'), 'utf8')) : null);
const all = process.argv.includes('--all');
const open = (list) => (list ?? []).filter((c) => all || c.pick === undefined);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

rmSync(join(OUT, 'files'), { recursive: true, force: true });
mkdirSync(join(OUT, 'files'), { recursive: true });

/** Loudness-matched copy for the page; returns its relative path. */
function copy(rel, lufs) {
  const name = rel.replace(/\//g, '__');
  normalize(join(SRC, rel), join(OUT, 'files', name), { lufs });
  return `files/${name}`;
}

/** One playable take with a star (a radio in its group). */
const take = (group, label, src, note = '') =>
  `<label class="take"><input type="radio" name="${esc(group)}" value="${esc(label)}"><span class="star">★</span><span class="tl">${esc(label)}</span><audio controls preload="none" src="${esc(src)}"></audio>${note ? `<small>${note}</small>` : ''}</label>`;

const sections = [];

// Effects.
{
  const rows = open(cues.effects).map((e) => {
    const r = rec(join(SRC, 'effects', e.id));
    if (!r) return '';
    const takes = r.takes.map((t, i) => take(`efekt: ${e.id}`, `wersja ${i + 1}`, copy(`effects/${e.id}/${t.file}`, -16))).join('');
    return `<div class="cue"><h3>${esc(e.label ?? e.event)} <code>${esc(e.id)}</code></h3><p class="prompt">${esc(e.prompt)}</p><div class="takes">${takes}</div></div>`;
  });
  sections.push(`<section><h2>1. Efekty</h2><p>Wszystkie mają tę samą paletę: ciepłe, okrągłe, „kreskówkowa dżungla”. Czy brzmią jak jedna rodzina?</p>${rows.join('')}</section>`);
}

// Music.
{
  const rows = open(cues.music).map((m) => {
    const r = rec(join(SRC, 'music', m.id));
    if (!r) return '';
    const takes = r.takes.map((t, i) => take(`muzyka: ${m.id}`, `wersja ${i + 1}`, copy(`music/${m.id}/${t.file}`, -19), `${t.seconds} s`)).join('');
    return `<div class="cue"><h3>${esc(m.label ?? 'Motyw otwarcia')} <code>${esc(m.id)}</code></h3><p class="prompt">${esc(m.event)}</p><div class="takes">${takes}</div></div>`;
  });
  sections.push(`<section><h2>2. Muzyka</h2><p>Krótkie motywy w stylu motywu otwarcia (wersja 1, którą wybrałeś).</p>${rows.join('')}</section>`);
}

// Voice designs.
{
  const rows = open(cues.voices).map((v) => {
    const r = rec(join(SRC, 'voices', v.id));
    if (!r) return '';
    const pick = saved[v.id]?.pick;
    const takes = r.previews.map((p, i) => take(`głos: ${v.id}`, `próbka ${i + 1}`, copy(`voices/${v.id}/${p.file}`, -19), i + 1 === pick ? 'zapisana, mówi kwestie poniżej' : '')).join('');
    return `<div class="cue"><h3>${esc(v.name)}</h3><p class="prompt">${esc(v.description)}</p><div class="takes">${takes}</div></div>`;
  });
  sections.push(`<section><h2>3. Głosy: trzy próbki każdego</h2><p>Każdy głos jest zaprojektowany od zera (bez naśladowania aktorów z serialu). Kwestie niżej mówi próbka 1; jeśli wolisz inną, zaznacz ją, a podmienię głos.</p>${rows.join('')}</section>`);
}

// Lines: v3 against v4.
const lineRow = (l) => {
  const models = l.models ?? cues.lineDefaults.models;
  const cells = models.flatMap((model) => {
    const r = rec(join(SRC, 'lines', l.id, model));
    if (!r) return [];
    return r.takes.map((t, i) => {
      const c = checks[`${l.id}/${model}/${t.file}`];
      const note = c ? `${c.ok ? '✓' : '✗'} słyszę: „${esc(c.heard)}”${c.events?.length ? ` · <b>${esc(c.events.join(', '))}</b>` : ''}` : '';
      return take(`kwestia: ${l.id}`, `${model.replace('eleven_', '')} · ${i + 1}`, copy(`lines/${l.id}/${model}/${t.file}`, -19), note);
    });
  });
  return `<div class="cue"><h3>${esc(l.text)} <code>${esc(l.id)}</code></h3>${l.say !== l.text ? `<p class="prompt">z tagami: ${esc(l.say)}</p>` : ''}<div class="takes">${cells.join('')}</div></div>`;
};
const main = open(cues.lines);
sections.push(
  `<section><h2>4. Kwestie</h2><p>Model v4, jeden głos na postać w obu językach, po dwa podejścia. Pod nagraniem: co usłyszała automatyczna transkrypcja (sprawdzam, czy tekst jest poprawny i czy tag typu [giggles] nie został przeczytany na głos); <b>pogrubione</b> = usłyszany śmiech.</p>${main.map(lineRow).join('')}</section>`,
);

const page = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>Dino Labirynty: odsłuch dźwięków</title>
<style>
body{font:15px/1.45 -apple-system,system-ui,sans-serif;max-width:1100px;margin:24px auto;padding:0 16px;background:#f7f1df;color:#2f3a1f}
h1{color:#3d7a1c}h2{margin-top:36px;border-bottom:2px solid #9cc46a;padding-bottom:4px}h3{margin:0 0 4px;font-size:16px}
code{font-size:12px;color:#7a6a3a;background:#efe5c4;padding:1px 4px;border-radius:4px}
.cue{background:#fffaf0;border:1px solid #e3d6ad;border-radius:12px;padding:12px 14px;margin:12px 0}
.prompt{margin:0 0 8px;color:#6b6450;font-size:13px}
.takes{display:flex;flex-wrap:wrap;gap:10px}
.take{display:flex;flex-direction:column;gap:4px;background:#f3ecd5;border:2px solid transparent;border-radius:10px;padding:8px;cursor:pointer;width:240px}
.take:has(input:checked){border-color:#e0a400;background:#fff3c4}
.take input{display:none}.star{color:#c9bb8f;font-size:18px}.take:has(input:checked) .star{color:#e0a400}
.tl{font-weight:600}audio{width:100%}small{color:#6b6450;font-size:12px}
#bar{position:sticky;top:0;background:#3d7a1c;color:#fff;padding:10px 14px;border-radius:0 0 12px 12px;display:flex;gap:12px;align-items:center;z-index:1}
#bar button{font:inherit;padding:6px 14px;border-radius:8px;border:0;background:#ffd34d;color:#2f3a1f;font-weight:700;cursor:pointer}
textarea{width:100%;height:120px;margin-top:8px}
</style></head><body>
<div id="bar"><span>Zaznacz ★ ulubione, potem:</span><button id="copy">Kopiuj wybory</button><span id="count"></span></div>
<h1>Dino Labirynty: pilot dźwięku</h1>
<p>Wszystkie nagrania mają wyrównaną głośność, więc porównujesz brzmienie, nie głośność. Uwagi możesz dopisać w polu na dole; „Kopiuj wybory” skopiuje gwiazdki i uwagi, wystarczy wkleić mi je w czacie.</p>
${sections.join('\n')}
<section><h2>Uwagi</h2><textarea id="notes" placeholder="Np. efekty za ciche/za głośne, Czupur za szybki, motyw za spokojny…"></textarea>
<textarea id="out" readonly placeholder="Tu pojawi się podsumowanie do skopiowania."></textarea></section>
<script>
const KEY='dino-audio-review';
const state=JSON.parse(localStorage.getItem(KEY)||'{}');
for(const [g,v] of Object.entries(state.picks||{})){const el=[...document.querySelectorAll('input[type=radio]')].find(i=>i.name===g&&i.value===v);if(el)el.checked=true;}
document.getElementById('notes').value=state.notes||'';
const save=()=>{const picks={};for(const i of document.querySelectorAll('input[type=radio]:checked'))picks[i.name]=i.value;localStorage.setItem(KEY,JSON.stringify({picks,notes:document.getElementById('notes').value}));document.getElementById('count').textContent=Object.keys(picks).length+' wybranych';return picks;};
document.addEventListener('change',save);document.getElementById('notes').addEventListener('input',save);save();
document.querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(b!==a)b.pause();})));
document.getElementById('copy').onclick=async()=>{const picks=save();const text=Object.entries(picks).map(([g,v])=>g+' → '+v).join('\\n')+'\\n\\nUwagi: '+(document.getElementById('notes').value||'-');const out=document.getElementById('out');out.value=text;try{await navigator.clipboard.writeText(text);document.getElementById('copy').textContent='Skopiowane ✓';}catch{out.select();document.execCommand('copy');document.getElementById('copy').textContent='Skopiowane ✓';}setTimeout(()=>document.getElementById('copy').textContent='Kopiuj wybory',2000);};
</script></body></html>
`;
writeFileSync(join(OUT, 'index.html'), page);
console.log(`review page: ${join(OUT, 'index.html')}`);
