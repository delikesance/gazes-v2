// Service Worker for caching critical resources
const CACHE_NAME = 'gazes-v2-cache-v1'
const STATIC_CACHE = 'gazes-static-v1'

// TypeScript declarations for service worker
/// <reference no-default-lib="true"/>
/// <reference lib="es2020" />
/// <reference lib="webworker" />

// Critical resources to cache immediately
const CRITICAL_RESOURCES = [
  '/',
  '/favicon.ico',
  '/robots.txt'
]

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first for static assets
  cacheFirst: async (request) => {
    try {
      const cachedResponse = await caches.match(request)
      if (cachedResponse) {
        return cachedResponse
      }

      const networkResponse = await fetch(request)
      if (networkResponse.ok) {
        const cache = await caches.open(STATIC_CACHE)
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    } catch (error) {
      console.log('Cache first failed:', error)
      return new Response('Offline', { status: 503 })
    }
  },

  // Network first for dynamic content
  networkFirst: async (request) => {
    try {
      const networkResponse = await fetch(request)
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME)
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    } catch (error) {
      const cachedResponse = await caches.match(request)
      if (cachedResponse) {
        return cachedResponse
      }
      return new Response('Offline', { status: 503 })
    }
  },

  // Stale while revalidate
  staleWhileRevalidate: async (request) => {
    const cache = await caches.open(CACHE_NAME)
    const cachedResponse = await cache.match(request)

    const fetchPromise = fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    })

    return cachedResponse || fetchPromise
  }
}

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing')
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      try {
        await cache.addAll(CRITICAL_RESOURCES)
        console.log('Critical resources cached')
      } catch (error) {
        console.log('Failed to cache critical resources:', error)
      }
      // Force activation
      self.skipWaiting()
    })()
  )
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating')
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
      // Take control of all clients
      self.clients.claim()
    })()
  )
})

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Handle API routes
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(CACHE_STRATEGIES.networkFirst(request))
    return
  }

  // Handle external anime-sama.fr images
  if (url.origin === 'https://anime-sama.fr' && request.destination === 'image') {
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request))
    return
  }

  // Skip other external requests
  if (!url.origin.includes(self.location.origin)) return

  // Handle different resource types
  if (request.destination === 'document') {
    // HTML pages - network first
    event.respondWith(CACHE_STRATEGIES.networkFirst(request))
  } else if (request.destination === 'script' || request.destination === 'style') {
    // JS/CSS - cache first
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request))
  } else if (request.destination === 'image') {
    // Images - cache first with longer TTL
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request))
  } else if (request.destination === 'font') {
    // Fonts - cache first
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request))
  } else {
    // Other resources - stale while revalidate
    event.respondWith(CACHE_STRATEGIES.staleWhileRevalidate(request))
  }
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  // Handle background sync tasks
  console.log('Background sync triggered')
}

// Push notifications (if needed later)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey
      }
    }
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.openWindow(event.notification.data.url || '/')
  )
})