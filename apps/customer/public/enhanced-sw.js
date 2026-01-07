// Enhanced Service Worker for Tabeza Customer App PWA
const CACHE_NAME = 'tabeza-customer-v1';
const RUNTIME_CACHE = 'tabeza-runtime';
const STATIC_CACHE = 'tabeza-static';

// Assets to cache for offline functionality
const CACHE_ASSETS = [
  '/',
  '/menu',
  '/start',
  '/api/menu',
  '/api/orders',
  '/api/payments'
];

// API endpoints to cache
const API_CACHE = [
  '/api/menu',
  '/api/orders',
  '/api/payments',
  '/api/create-tab',
  '/api/validate-device'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(CACHE_ASSETS.map(url => new Request(url)));
      })
  );
  
  // Skip waiting for immediate activation
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      console.log('🧹 Old caches cleaned up');
    })
  );
});

// Network first strategy with offline fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and external resources
  if (request.method !== 'GET' || 
      url.origin !== self.location.origin ||
      url.pathname.includes('_next') ||
      url.pathname.includes('vercel')) {
    return fetch(request);
  }
  
  // Check if this is an API request that should be cached
  const isApiRequest = API_CACHE.some(apiPath => url.pathname.includes(apiPath));
  
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached response if available
        if (response) {
          console.log('📦 Cache hit:', url.pathname);
          return response;
        }
        
        // For API requests, try network first with cache fallback
        if (isApiRequest) {
          return fetch(request)
            .then((networkResponse) => {
              // Cache successful API responses
              if (networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(request, responseClone))
                  .then(() => {
                    console.log('💾 API response cached:', url.pathname);
                  });
              }
              return networkResponse;
            })
            .catch(() => {
              // Return offline fallback for API requests
              console.log('📵 Network failed, returning offline API response');
              return new Response(
                JSON.stringify({ 
                  error: 'Offline - Please check your connection',
                  message: 'Some features may be limited until you reconnect',
                  timestamp: new Date().toISOString()
                }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                  }
                }
              );
            });
        }
        
        // For static assets, try network first with cache fallback
        return fetch(request)
          .then((networkResponse) => {
            // Cache successful static responses
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Return cached version or offline fallback
            if (response) {
              console.log('📵 Network failed, returning cached version');
              return response;
            }
            
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              console.log('📵 Offline - returning offline page');
              return new Response(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>Tabeza - Offline</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link rel="manifest" href="/manifest.json">
                    <style>
                      body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
                        color: white;
                        text-align: center;
                      }
                      .offline-container {
                        text-align: center;
                        padding: 2rem;
                      }
                      .offline-icon {
                        font-size: 4rem;
                        margin-bottom: 1rem;
                      }
                      .offline-title {
                        font-size: 1.5rem;
                        font-weight: 600;
                        margin-bottom: 0.5rem;
                      }
                      .offline-message {
                        font-size: 1rem;
                        margin-bottom: 2rem;
                        opacity: 0.8;
                      }
                      .retry-button {
                        background: white;
                        color: #ea580c;
                        border: none;
                        padding: 1rem 2rem;
                        border-radius: 0.5rem;
                        font-weight: 600;
                        cursor: pointer;
                        margin-top: 2rem;
                      }
                    </style>
                  </head>
                  <body>
                    <div class="offline-container">
                      <div class="offline-icon">🍺</div>
                      <div class="offline-title">Tabeza Offline</div>
                      <div class="offline-message">
                        Check your internet connection and try again
                      </div>
                      <button class="retry-button" onclick="window.location.reload()">
                        Retry
                      </button>
                    </div>
                  </body>
                </html>
              `, {
                headers: {
                  'Content-Type': 'text/html',
                  'Cache-Control': 'no-cache'
                }
              });
            }
            
            // Return offline asset for other requests
            console.log('📵 Network failed, no cache available');
            return new Response('Offline', { status: 503 });
          });
      });
  });
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered');
  event.waitUntil(
    Promise.all(
      event.tag.map((tag) => {
        if (tag.method === 'POST' && tag.url.includes('/api/')) {
          return fetch(tag.url, {
            method: 'POST',
            headers: tag.headers,
            body: tag.body
          }).then((response) => {
            if (response.ok) {
              console.log('✅ Background sync successful:', tag.url);
              return response.json();
            }
            throw new Error('Background sync failed');
          });
        }
        return Promise.resolve();
      })
    )
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received:', event);
  
  const options = {
    body: event.data?.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: event.data?.data,
    actions: event.data?.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(event.data?.title || 'Tabeza Update', options)
  );
});

// Message handler for client communication
self.addEventListener('message', (event) => {
  console.log('💬 Message received in service worker:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('🚀 Enhanced Service Worker loaded for Tabeza Customer App');
