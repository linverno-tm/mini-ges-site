/* MINI GES service worker: instant repeat visits and an offline copy of the site.
 * HTML: network first (3 s budget), then cache.  Versioned CSS/JS, images, fonts: cache first.
 * The build replaces VERSION and the PRECACHE list. */
const VERSION = '%BUILD_ID%';
const CORE = `core-${VERSION}`;
const RUNTIME = 'runtime-v1';
const PRECACHE = /*PRECACHE*/[]/*END*/;
const RUNTIME_LIMIT = 150;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CORE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CORE && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const trim = async (name, max) => {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
};

const networkFirst = async (request) => {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 3000)),
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    return (await caches.match(request)) || (await caches.match(new URL('./', self.registration.scope).href)) || Response.error();
  }
};

const cacheFirst = async (request) => {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(RUNTIME);
    cache.put(request, response.clone());
    trim(RUNTIME, RUNTIME_LIMIT);
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate') { event.respondWith(networkFirst(request)); return; }
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const ownStatic = url.origin === self.location.origin && /\.(css|js|webp|jpg|png|webmanifest)$/.test(url.pathname);
  if (fonts || ownStatic) event.respondWith(cacheFirst(request));
});
