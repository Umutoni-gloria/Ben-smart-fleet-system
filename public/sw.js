self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('ben-supply-v1').then((cache) => cache.addAll([
      '/mobile',
      '/mobile/scanner',
      '/api/sync'
    ]))
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
