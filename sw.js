const CACHE_NAME = 'ez-drop-cache-v1.2';
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
  // Ignore non-GET requests immediately
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cache-First with Network Fallback Strategy for local static shell, serving offline instantly
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => {
          // Absolute offline fallback
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
  } else {
    // Network-First with Cache Fallback for CDN third party elements to avoid stale states
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
