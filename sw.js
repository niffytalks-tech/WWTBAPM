// sw.js — Service Worker
// Caches the app shell so it loads instantly and works offline
// after the first visit

const CACHE_NAME = 'p2-quiz-v1';

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Cinzel:wght@400;600;700&family=Raleway:wght@300;400;500;600&display=swap'
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — serve from cache, fall back to network
// Never cache the Netlify function (always needs live network)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for the verification function
  if (url.pathname.startsWith('/.netlify/functions/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
