/**
 * App icons and favicons (tools/art/make_icons.py): every icon the page and the
 * web app manifest point to exists and is the size it claims to be.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): [number, number] {
  const b = readFileSync(resolve(ROOT, 'public', path));
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('app icons', () => {
  it('the page links Giganto favicons and an iOS icon that exist at their declared sizes', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const links = [...html.matchAll(/<link rel="(icon|apple-touch-icon)"[^>]*>/g)].map((m) => m[0]);
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      const href = /href="\.\/([^"]+)"/.exec(link)![1]!;
      expect(href).toMatch(/^icons\/giganto-/);
      const [w, h] = pngSize(href);
      expect(w).toBe(h);
      const sizes = /sizes="(\d+)x(\d+)"/.exec(link);
      if (sizes) expect([w, h]).toEqual([Number(sizes[1]), Number(sizes[2])]);
      else expect(w).toBe(180);
    }
  });

  it("the manifest's icons exist at their declared sizes, including a maskable one", () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'public/manifest.webmanifest'), 'utf8')) as {
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };
    for (const icon of manifest.icons) expect(pngSize(icon.src).join('x')).toBe(icon.sizes);
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});
