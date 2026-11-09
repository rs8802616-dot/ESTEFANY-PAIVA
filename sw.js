const CACHE_NAME = 'estefany-nails-v30-fix-videos-playback-and-upload';
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './master.html',
  './manifest.json',
  './assets/css/variables.css',
  './assets/css/client.css',
  './assets/css/admin.css',
  './assets/js/store.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Estratégia Network-First: garante que celular e computador sempre carreguem a versão mais recente
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('ntfy.sh')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            if (event.request.url.includes('admin.html')) {
              return caches.match('./admin.html');
            } else if (event.request.url.includes('master.html')) {
              return caches.match('./master.html');
            }
            return caches.match('./index.html');
          }
        });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('./admin.html');
    })
  );
});
