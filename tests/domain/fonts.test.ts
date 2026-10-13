/**
 * The UI font must really contain every Polish letter. Fredoka (used before)
 * shipped only ó and ł, so ą ć ę ń ś ź ż silently fell back to another font.
 * This reads the cmap of every woff2 file declared in src/fonts.css (WOFF2
 * tables are brotli-compressed; cmap is never transformed) and checks coverage
 * per weight, respecting each face's unicode-range.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const CSS = process.env['FONT_CSS'] ?? resolve(ROOT, 'src/fonts.css');

const POLISH = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ';
const PUNCTUATION = '„”…–';
const ASCII = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?.,:;\'"()';

const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

/** Unicode code points mapped to a real glyph by a woff2 font. */
function woff2Codepoints(buf: Buffer): Set<number> {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not woff2');
  const numTables = buf.readUInt16BE(12);
  let p = 48;
  const readBase128 = (): number => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[p++] as number;
      v = v * 128 + (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    throw new Error('bad UIntBase128');
  };
  const tables: Array<{ tag: string; length: number }> = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++] as number;
    const idx = flags & 0x3f;
    let tag: string;
    if (idx === 63) {
      tag = buf.toString('latin1', p, p + 4);
      p += 4;
    } else tag = KNOWN_TAGS[idx] as string;
    const version = flags >> 6;
    const origLength = readBase128();
    // glyf/loca are transformed when version is 0; other tables when version is non-zero.
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    const length = transformed ? readBase128() : origLength;
    tables.push({ tag, length });
  }
  const totalCompressed = buf.readUInt32BE(20);
  const data = brotliDecompressSync(buf.subarray(p, p + totalCompressed));
  let off = 0;
  let cmapAt = -1;
  for (const t of tables) {
    if (t.tag === 'cmap') cmapAt = off;
    off += t.length;
  }
  if (cmapAt < 0) throw new Error('no cmap');
  return parseCmap(data, cmapAt);
}

function parseCmap(d: Buffer, base: number): Set<number> {
  const out = new Set<number>();
  const n = d.readUInt16BE(base + 2);
  for (let i = 0; i < n; i++) {
    const rec = base + 4 + i * 8;
    const platform = d.readUInt16BE(rec);
    const encoding = d.readUInt16BE(rec + 2);
    if (platform !== 3 && platform !== 0) continue;
    const sub = base + d.readUInt32BE(rec + 4);
    const format = d.readUInt16BE(sub);
    if (format === 4 && (platform === 0 || encoding === 1)) {
      const segX2 = d.readUInt16BE(sub + 6);
      const ends = sub + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const ranges = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = d.readUInt16BE(ends + 2 * s);
        const start = d.readUInt16BE(starts + 2 * s);
        const delta = d.readInt16BE(deltas + 2 * s);
        const rangeAt = ranges + 2 * s;
        const range = d.readUInt16BE(rangeAt);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g: number;
          if (range === 0) g = (c + delta) & 0xffff;
          else {
            g = d.readUInt16BE(rangeAt + range + 2 * (c - start));
            if (g !== 0) g = (g + delta) & 0xffff;
          }
          if (g !== 0) out.add(c);
        }
      }
    } else if (format === 12) {
      const groups = d.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const at = sub + 16 + g * 12;
        const start = d.readUInt32BE(at);
        const end = d.readUInt32BE(at + 4);
        for (let c = start; c <= end; c++) out.add(c);
      }
    }
  }
  return out;
}

function parseRanges(range: string): Array<[number, number]> {
  return range.split(',').map((r) => {
    const [a, b] = r.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(a as string, 16), parseInt((b ?? a) as string, 16)];
  });
}

interface Face {
  weight: number;
  file: string;
  ranges: Array<[number, number]>;
}

function declaredFaces(): Face[] {
  const css = readFileSync(CSS, 'utf8');
  const faces: Face[] = [];
  for (const block of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
    const weight = Number(/font-weight:\s*(\d+)/.exec(block)?.[1]);
    const url = /url\('([^']+\.woff2)'\)/.exec(block)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
    if (!url || !range) throw new Error(`incomplete @font-face: ${block}`);
    faces.push({ weight, file: resolve(dirname(CSS), url), ranges: parseRanges(range) });
  }
  return faces;
}

describe('UI font coverage', () => {
  const faces = declaredFaces();
  const weights = [...new Set(faces.map((f) => f.weight))];

  it('declares every face with a unicode-range and woff2 only', () => {
    expect(faces.length).toBeGreaterThanOrEqual(2);
    expect(weights.length).toBeGreaterThanOrEqual(2);
  });

  for (const weight of weights) {
    it(`weight ${weight} renders every Polish letter, quote and basic Latin from the font itself`, () => {
      const mine = faces.filter((f) => f.weight === weight).map((f) => ({ ...f, cps: woff2Codepoints(readFileSync(f.file)) }));
      const missing: string[] = [];
      for (const ch of POLISH + PUNCTUATION + ASCII) {
        const cp = ch.codePointAt(0) as number;
        // The face the browser picks is the one whose unicode-range claims the character.
        const face = mine.find((f) => f.ranges.some(([a, b]) => cp >= a && cp <= b));
        if (!face || !face.cps.has(cp)) missing.push(ch);
      }
      expect(missing.join('')).toBe('');
    });
  }

  it('the reader really detects a font without Polish letters', () => {
    // Fredoka's latin subset lacks ą: keep a tiny regression check of the reader itself
    // using the first declared latin-ext face, which must NOT contain plain ASCII.
    const ext = faces.find((f) => f.file.includes('latin-ext')) as Face;
    const cps = woff2Codepoints(readFileSync(ext.file));
    expect(cps.has('ą'.codePointAt(0) as number)).toBe(true);
    expect(cps.has('a'.codePointAt(0) as number)).toBe(false);
  });
});
