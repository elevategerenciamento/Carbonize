const CACHE_NAME = 'carbonize-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './public/carboniza_logo.png',
  './public/bg.png',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css',
  'https://cdn.jsdelivr.net/npm/flatpickr',
  'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener('fetch', event => {
  // Ignora chamadas de API do Supabase para não cachear dados dinâmicos
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchedResponse = fetch(event.request).then(networkResponse => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchedResponse;
      });
    })
  );
});

