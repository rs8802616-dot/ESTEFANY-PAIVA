const CACHE_NAME = 'estefany-nails-v4-real-photos';
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './master.html',
  './manifest.json',
  './assets/css/variables.css',
  './assets/css/client.css',
  './assets/css/admin.css',
  './assets/js/store.js',
  './assets/js/client.js',
  './assets/js/admin.js',
  './assets/images/trabalho-alongamento-chocolate.png',
  './assets/images/trabalho-amendoada-ouro.png',
  './assets/images/trabalho-tons-terrosos.png',
  './assets/images/trabalho-francesa-estrela.png',
  './assets/images/trabalho-perolada-glaze.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => console.log('Cache warn:', err));
    })
  );
  self.skipWaiting();
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Suporte a push notifications e abertura direta da notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('./admin.html');
    })
  );
});
