// Service Worker — Expense Tracker PWA
// প্রতি update এ CACHE_VERSION বাড়ান → পুরনো cache আপনাআপনি মুছে যাবে

const CACHE_VERSION = 'v4'; // ← আপডেট করলে এটা বাড়ান: v5, v6...
const CACHE_NAME = 'expense-tracker-' + CACHE_VERSION;

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
  // নতুন SW সাথে সাথে activate হবে, অপেক্ষা করবে না
  self.skipWaiting();
});

// Activate — পুরনো সব cache মুছুন
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME) // শুধু পুরনো version মুছো
          .map(k => {
            console.log('Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim()) // সব open tab এ নতুন SW নাও
  );
});

// Fetch
self.addEventListener('fetch', event => {

  // Google Apps Script — সবসময় network (cache bypass)
  if (event.request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        JSON.stringify({ ok: false, msg: 'Offline' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Google Fonts — Cache first, network fallback
  if (
    event.request.url.includes('fonts.googleapis.com') ||
    event.request.url.includes('fonts.gstatic.com')
  ) {
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

  // App files (index.html, manifest.json, etc.)
  // Network First — সবসময় নতুন version দেখবে, offline হলে cache থেকে দেবে
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // সফল response cache এ রাখো (নতুন version update হবে)
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline — cache থেকে দাও
        return caches.match(event.request).then(cached => {
          return cached || caches.match('/index.html');
        });
      })
  );
});
