const CACHE_NAME = 'sistec-cdn-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js'
      ]);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.map(n => n !== CACHE_NAME ? caches.delete(n) : null)))
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ erro: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  if (url.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.match(event.request).then(res => res || fetch(event.request).then(r => { const clone = r.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, clone)); return r; }))
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
