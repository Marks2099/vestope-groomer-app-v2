const CACHE_NAME = 'vestope-groomer-v2-shell-v6';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './src/phase5-report.css',
  './app.js',
  './src/phase5-report-form.js',
  './src/photo-store.js',
  './src/ride-engine.js',
  './src/ride-store.js',
  './manifest.webmanifest',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('vestope-groomer-v2-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isAppCode = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/app.js') || url.pathname.endsWith('/styles.css') || url.pathname.endsWith('/src/phase5-report.css') || url.pathname.endsWith('/src/phase5-report-form.js') || url.pathname.endsWith('/src/photo-store.js') || url.pathname.endsWith('/src/ride-engine.js') || url.pathname.endsWith('/src/ride-store.js');
  event.respondWith(isAppCode ? fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)); return response; }).catch(()=>caches.match(event.request)) : caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));return response;})));
});
