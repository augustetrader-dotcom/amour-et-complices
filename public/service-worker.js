// Service Worker pour Amour & Complices
const CACHE_NAME = 'amour-complices-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/config.js',
  '/js/supabase.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Installation du service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation du service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

<<<<<<< HEAD
  const requestUrl = new URL(event.request.url);
  const isAppShellAsset = requestUrl.origin === self.location.origin &&
    urlsToCache.includes(requestUrl.pathname);

  if (isAppShellAsset) {
    const networkUpdate = caches.open(CACHE_NAME).then(cache =>
      fetch(event.request).then(response => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    event.waitUntil(networkUpdate.catch(() => {}));
    event.respondWith(caches.match(event.request).then(cached => cached || networkUpdate));
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        const requestUrl = new URL(event.request.url);
        if (response.ok && requestUrl.origin === self.location.origin && urlsToCache.includes(requestUrl.pathname)) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        return (await caches.match(event.request)) || Response.error();
      }
    })()
  );
    })()
  );
});

// Gestion des messages (pour les mises à jour)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener("push", event => {
  let data = { title: "💌 Amour & Complices", body: "Nouveau message", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (error) {}

  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "amour-complices",
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
    for (const client of clientList) {
      if (client.url.includes(self.location.origin) && "focus" in client) return client.focus();
    }
    return self.clients.openWindow(url);
  }));
});