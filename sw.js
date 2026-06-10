const CACHE_NAME = 'ez-drop-cache-v1.9'; // Bumped cache to force-evict stale app-shell assets
const DEBUG_LOGS = false;
const DB_NAME = 'ezdrop-db';
const DB_VERSION = 1;
const SHARE_STORE = 'shared_items';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './assets/logo.png'
];

function openEzDropDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) {
        db.createObjectStore(SHARE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('known_peers')) {
        db.createObjectStore('known_peers', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeSharedPayload(request) {
  const formData = await request.formData();
  const id = `share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const files = [];

  for (const value of formData.values()) {
    if (value instanceof File && value.size > 0) {
      files.push(value);
    }
  }

  const record = {
    id,
    createdAt: Date.now(),
    title: formData.get('title') || '',
    text: formData.get('text') || '',
    url: formData.get('url') || '',
    files
  };

  const db = await openEzDropDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, 'readwrite');
    tx.objectStore(SHARE_STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return id;
}

// Offline fallback for critical CDN dependencies
const CDN_ASSETS = [
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
        if (DEBUG_LOGS) console.log('[sw.js] Precaching essential local assets...');
        return Promise.allSettled([
          cache.addAll(PRECACHE_ASSETS),
          ...CDN_ASSETS.map(url => (
            fetch(new Request(url, { mode: 'no-cors' }))
              .then(res => cache.put(url, res))
          ))
        ]).then(results => {
          results
            .filter(result => result.status === 'rejected')
            .forEach(result => console.warn('[sw.js] Precache item skipped:', result.reason));
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
            if (DEBUG_LOGS) console.log('[sw.js] Evicting outdated service caches:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const id = await storeSharedPayload(event.request);
        return Response.redirect(`./?shared=${encodeURIComponent(id)}`, 303);
      } catch (err) {
        console.error('[sw.js] Share target ingest failed:', err);
        return Response.redirect('./?share-error=1', 303);
      }
    })());
    return;
  }

  if (event.request.method !== 'GET') return;

  if (!['http:', 'https:'].includes(url.protocol)) return;

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
        .catch(() => caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline asset unavailable' });
        }))
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

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('./');
    })
  );
});
