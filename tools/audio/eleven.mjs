// ElevenLabs API client for the offline audio tools (docs/SOUND_PLAN.md).
// The key is read from .env.local (never committed, never shipped) and never
// printed: errors show the status and the API's message only.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');
const BASE = 'https://api.elevenlabs.io';

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  let text;
  try {
    text = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  } catch {
    throw new Error('No .env.local with ELEVENLABS_API_KEY in the project root.');
  }
  const line = text.split(/\r?\n/).find((l) => /^\s*ELEVENLABS_API_KEY\s*=/.test(l));
  const key = line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  if (!key) throw new Error('ELEVENLABS_API_KEY is empty in .env.local.');
  return key;
}

/**
 * Call the API. `body` objects are sent as JSON, FormData as multipart. Returns parsed JSON, or a
 * Buffer for audio responses.
 */
export async function eleven(path, { method = 'GET', body, query } = {}) {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method,
      // FormData (file uploads) sets its own multipart content type.
      headers: { 'xi-api-key': apiKey(), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    // Busy or rate-limited: wait and try again (a few times).
    if ((res.status === 429 || res.status === 409 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok) {
      const detail = type.includes('json') ? JSON.stringify((await res.json()).detail ?? {}) : await res.text();
      throw new Error(`${method} ${url.pathname} → ${res.status}: ${detail.slice(0, 600)}`);
    }
    if (type.includes('json')) return res.json();
    return Buffer.from(await res.arrayBuffer());
  }
}
