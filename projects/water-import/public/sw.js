/* «Знакомая вода» — service worker.
   Задача простая и осторожная: игра открывается из кэша, когда сети нет,
   и ставится на телефон. Данные игрока он не кэширует никогда. */

const VERSION = "zv-v1";
const CACHE = `zv-${VERSION}`;
const OFFLINE = "/offline";

// Что кладём в кэш при установке. Каждый файл отдельно — если чего-то нет,
// установка не сломается.
const PRECACHE = ["/", OFFLINE, "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Данные игрока и API — только сеть: устаревшее сохранение хуже, чем его отсутствие. */
const isApi = (url) => url.pathname.startsWith("/api/");
/** Статика Next.js неизменяема — её берём из кэша сразу. */
const isStatic = (url) => url.pathname.startsWith("/_next/static/") || /\.(png|jpg|jpeg|svg|ico|webmanifest|woff2?)$/.test(url.pathname);

async function handle(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || isApi(url)) {
    return fetch(request);
  }

  if (isStatic(url)) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const res = await fetch(request);
      if (res.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, res.clone());
      }
      return res;
    } catch {
      return caches.match(OFFLINE);
    }
  }

  // Страницы: сначала сеть, потом кэш, в крайнем случае — «нет связи»
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE);
    return offline ?? new Response("Нет связи", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});
