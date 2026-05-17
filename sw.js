// Service Worker — Expense Tracker PWA
// সব file cache করে রাখবে, offline এও app চলবে

const CACHE_NAME = 'expense-tracker-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap'
];

// Install — সব files cache করুন
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.log('Cache partial fail (ok):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — পুরনো cache মুছুন
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — Cache First strategy
self.addEventListener('fetch', event => {
  // Google Apps Script calls — network only (bypass cache)
  if (event.request.url.includes('script.google.com')) {
    event.respondWith(fetch(event.request).catch(() => new Response(
      JSON.stringify({ ok: false, msg: 'Offline' }),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // Google Fonts — network with cache fallback
  if (event.request.url.includes('fonts.googleapis.com') || event.request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // App files — Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — index.html return করুন
        return caches.match('/index.html');
      });
    })
  );
});
