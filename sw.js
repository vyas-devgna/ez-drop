const CACHE_NAME = 'ez-drop-cache-v1.3'; // Bumped cache to force-evict poisoned states
const PRECACHE_ASSETS = [
  './',
  './index.html'
];

// Offline fallback for critical CDN dependencies
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Playfair+Display:ital,wght@0,700;1,400&family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://unpkg.com/html5-qrcode/html5-qrcode.min.js',
  'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[sw.js] Precaching essential local assets...');
        cache.addAll(PRECACHE_ASSETS).catch(err => {
          console.warn('[sw.js] Precache failed, continuing dynamically:', err);
        });
        
        // Cache external library dependencies
        CDN_ASSETS.forEach(url => {
          fetch(new Request(url, { mode: 'no-cors' }))
            .then(res => cache.put(url, res))
            .catch(err => console.warn(`[sw.js] Failed precaching CDN library: ${url}`, err));
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[sw.js] Evicting outdated service caches:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // CRITICAL FIX: Explicitly bypass Service Worker for PeerJS signaling server traffic!
  // This prevents cache poisoning of dynamically allocated room/peer IDs.
  if (url.hostname.includes('peerjs') || url.pathname.includes('/peerjs')) {
    return; // Pass directly to the network without SW intervention
  }

  // Network-First Strategy for local origin (index.html, etc.)
  // Ensures that online users always get the absolute freshest build, fallback to cache offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
  } else {
    // Cache-First Strategy with Network Fallback for static CDN libraries
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then(response => {
            if (response && (response.status === 200 || response.type === 'opaque')) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          });
        })
    );
  }
});
