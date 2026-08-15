const CACHE_NAME = 'vestope-groomer-v2-shell-v12';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './assets/groomer.svg', './assets/icons/icon-192.svg', './assets/icons/icon-512.svg',
  './app.js', './src/auth-gate.js', './src/auth-gate.css', './src/pwa-install.js',
  './src/groomer-profile.js', './src/phase5-report-form.js', './src/phase5-report.css',
  './src/phase6-ride-photo.js', './src/phase6-photo.css', './src/phase8-animation.css',
  './src/photo-capture.js', './src/photo-store.js', './src/ride-engine.js',
  './src/ride-store.js', './src/report-scheduler.js', './src/services/gps/location-detector.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('vestope-groomer-v2-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isEsmModule = url.origin === 'https://esm.sh';
  if (!isSameOrigin && !isEsmModule) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
        throw new Error('Offline resource unavailable');
      });
    })
  );
});
