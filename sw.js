// Service Worker — Expense Tracker PWA
const CACHE_VERSION = 'v6';
const CACHE_NAME = 'expense-tracker-' + CACHE_VERSION;

// ✅ শুধু নিজের ফাইল cache করো — Fonts আলাদা handle হবে
const CORE_ASSETS = [
  '/expense-tracker/',
  '/expense-tracker/index.html',
  '/expense-tracker/manifest.json'
];

// ─── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CORE_ASSETS.map(url =>
          fetch(url).then(res => {
            if (res && res.status === 200) return cache.put(url, res);
          }).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Google Apps Script — সবসময় network
  if (url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ ok: false, msg: 'Offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Google Fonts — Cache first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(res => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
            }
            return res;
          })
          .catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // App shell — Network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.status === 200 && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then(cached =>
          cached || caches.match('/expense-tracker/index.html')
        )
      )
  );
});
