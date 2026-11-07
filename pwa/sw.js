// Zena Network Service Worker (sw.js)
const CACHE_NAME = 'zena-shell-v1'
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/camera.js',
  './js/signature.js',
  './js/shipments.js',
  './js/settlements.js',
  './js/node-gov.js',
  './icons/icon.svg',
  'https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[Zena SW] Pre-caching offline shell assets')
        return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
          console.warn('[Zena SW] Non-critical cache warning:', err)
        })
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log('[Zena SW] Removing stale cache:', key)
              return caches.delete(key)
            }
          }),
        )
      })
      .then(() => self.clients.claim()),
  )
})

// Cache-First for static UI assets, Network-First for simulated API / dynamic requests
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // If request is within origin or static CDN, try Cache First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached and update in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone())
              })
            }
          })
          .catch(() => {
            /* offline */
          })
        return cachedResponse
      }

      // Network request fallback
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
          return response
        })
        .catch(() => {
          // Fallback for HTML documents
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html')
          }
        })
    }),
  )
})

// Listen for sync event (Background Sync API)
self.addEventListener('sync', (event) => {
  if (event.tag === 'zena-sync-handovers') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_TRIGGERED' })
        })
      }),
    )
  }
})
