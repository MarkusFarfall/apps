const CACHE = 'dmb-timer-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
        }
        return Response.error();
      }
    })()
  );
});
