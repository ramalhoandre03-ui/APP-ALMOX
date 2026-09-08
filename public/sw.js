const CACHE_NAME = 'cmpc-portal-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Install Event - Pre-cache core structural frame files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching structural shell assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event - Clean up stale cache configurations
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event - Stale-While-Revalidate strategy for static assets, bypassing APIs
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for backend APIs, Firestore, or hot-reload sockets
  if (
    url.pathname.startsWith('/api') || 
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('firebaseinstallations.googleapis.com') ||
    request.url.includes('socket.io') ||
    request.url.includes('ws') ||
    request.method !== 'GET'
  ) {
    // Direct network pass-through for non-GET or dynamic platform backend calls
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Fetch fresh copy from the network in background (dynamic caching)
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // If valid response, cache the newly requested asset (JS, CSS, fonts, etc.)
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.log('[Service Worker] Fetch failed, serving cached copy if possible:', err);
          // Return cached content if network is down
          return cachedResponse;
        });

      // Serve cached resource immediately to user if present, or wait for network response
      return cachedResponse || fetchPromise;
    })
  );
});
