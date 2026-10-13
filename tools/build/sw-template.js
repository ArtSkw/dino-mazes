/* Dino Mazes service worker (generated at build time; do not edit dist/sw.js).
 * App-shell strategy: every file of one build is precached under a versioned
 * cache. A new version installs in the background and waits; the page asks it to
 * activate only at a safe boundary (never mid-drawing), and old caches are
 * removed on activation. Saves live in localStorage and are never touched here.
 */
const VERSION = '__VERSION__';
const CACHE = `dino-mazes-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('dino-mazes-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html', { ignoreVary: true });
        if (shell) return shell;
      }
      const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (err) {
        if (req.mode === 'navigate') {
          const shell = await cache.match('./index.html', { ignoreVary: true });
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});
