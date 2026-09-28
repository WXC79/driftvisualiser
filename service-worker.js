const CACHE_NAME = 'drift-13-13-v1';
const CORE = [
  './',
  './index.html',
  './style.css?v=13.13',
  './app.js?v=13.13',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png',
  './drift-logo-master.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isAudio = /\.(mp3|m4a|aac|wav|flac|ogg)$/i.test(url.pathname);
  const isRange = event.request.headers.has('range');

  // Important for iOS/Safari media playback: let the browser handle audio and
  // byte-range requests natively. Do not put media responses through Cache API.
  if (isAudio || isRange) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(()=>{});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
