/* ДМБ Таймер — service worker: офлайн-кэш + приём push-уведомлений */
const CACHE = 'dmb-timer-v2';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

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

  const url = new URL(req.url);
  // API не кэшируем: уведомления и подписки всегда должны идти в сеть
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

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

/* ─────────── push-уведомления ─────────── */

self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    try {
      data = { title: 'ДМБ Таймер', body: e.data ? e.data.text() : '' };
    } catch {
      data = {};
    }
  }
  // поддержка обоих форматов: {…} и { notification: {…} }
  const n = data.notification ? { ...data, ...data.notification } : data;
  const title = n.title || 'ДМБ Таймер';
  const options = {
    body: n.body || '',
    icon: n.icon || './icon-192.png',
    badge: n.badge || './badge-72.png',
    tag: n.tag || 'dmb',
    renotify: Boolean(n.tag),
    vibrate: [16, 80, 16],
    lang: 'ru',
    data: { url: n.url || './' },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          try {
            await client.focus();
            return;
          } catch {
            /* продолжаем поиск */
          }
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});
