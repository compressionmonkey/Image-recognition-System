const CACHE_NAME = 'tshong-ai-cache';
const DYNAMIC_CACHE = 'dynamic-cache';
let appVersion = null;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/index.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js'
];

// Check version immediately upon installing or activating
async function checkForUpdates() {
  try {
    const response = await fetch('/version.txt?nocache=' + Date.now());
    if (!response.ok) return null;
    
    const newVersion = await response.text();
    if (!appVersion) {
      appVersion = newVersion;
      return false;
    }
    
    const hasUpdate = newVersion.trim() !== appVersion.trim();
    if (hasUpdate) {
      console.log('[Service Worker] New version detected:', newVersion, 'Current:', appVersion);
      appVersion = newVersion;
      return true;
    }
    return false;
  } catch (e) {
    console.error('[Service Worker] Version check failed:', e);
    return false;
  }
}

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(STATIC_ASSETS)),
      checkForUpdates()
    ]).then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then(keys => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
            .map(key => {
              console.log('[Service Worker] Deleting old cache', key);
              return caches.delete(key);
            })
        );
      }),
      // Check for updates
      checkForUpdates().then(hasUpdate => {
        if (hasUpdate) {
          // Notify clients about the update
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'UPDATE_AVAILABLE'
              });
            });
          });
        }
      })
    ])
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip certain URLs
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('/vision-api') ||
    event.request.url.includes('/record-cash') ||
    event.request.url.includes('/detect')
  ) {
    return;
  }

  // Special handling for version.txt to never cache it
  if (event.request.url.includes('/version.txt')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Always fetch a fresh copy of the HTML to ensure updates
        if (event.request.mode === 'navigate') {
          return fetch(event.request)
            .then(response => {
              if (!response || response.status !== 200) {
                return cachedResponse || response;
              }
              
              // Cache the latest HTML
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
              
              return response;
            })
            .catch(() => cachedResponse);
        }
        
        // For non-HTML resources, use cache-first approach
        if (cachedResponse) {
          // Update the cache in the background
          fetch(event.request)
            .then(response => {
              if (response && response.ok) {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, response));
              }
            })
            .catch(() => {});
          
          return cachedResponse;
        }

        // If not in cache, fetch from network
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200) {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Add to cache
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        // Return offline fallback if available
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      })
  );
});

// Handle updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    checkForUpdates().then(hasUpdate => {
      if (hasUpdate) {
        // Respond to the client
        event.ports[0].postMessage({ 
          type: 'UPDATE_AVAILABLE' 
        });
      }
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background update check every 15 minutes
setInterval(() => {
  checkForUpdates().then(hasUpdate => {
    if (hasUpdate) {
      // Notify all clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE'
          });
        });
      });
    }
  });
}, 15 * 60 * 1000); 