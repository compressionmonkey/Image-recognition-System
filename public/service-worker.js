const CACHE_NAME = 'app-cache-v1';
const DYNAMIC_CACHE_NAME = 'dynamic-cache-v1';

// Minimal assets to cache initially
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/index.js'
];

// Lightweight version check
async function checkVersion() {
  try {
    const response = await fetch('/version.json?t=' + Date.now());
    if (!response.ok) return false;
    const data = await response.json();
    const cachedVersion = localStorage.getItem('app-version');
    return data.version !== cachedVersion;
  } catch (error) {
    return false;
  }
}

// Installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activation with cache cleanup
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
            .map(key => caches.delete(key))
        );
      })
    ])
  );
});

// Optimized fetch handler
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls and other dynamic requests
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('/vision-api') ||
      event.request.url.includes('/record-cash')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Check version for main assets
        if (event.request.url.endsWith('.js') || 
            event.request.url.endsWith('.css') || 
            event.request.url.endsWith('.html')) {
          const hasUpdate = await checkVersion();
          if (hasUpdate) {
            const response = await fetch(event.request);
            if (response.ok) {
              const cache = await caches.open(CACHE_NAME);
              cache.put(event.request, response.clone());
              return response;
            }
          }
        }

        // Try cache first
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        // Network fetch with dynamic caching
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        // Return cached version on network failure
        return caches.match(event.request);
      }
    })()
  );
});

// Handle updates
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
}); 