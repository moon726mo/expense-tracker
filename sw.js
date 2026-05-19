// Service Worker — Expense Tracker PWA
// v6: Cache-First — long-term offline এ stable launch নিশ্চিত করে
const CACHE_VERSION = 'v6';
const CACHE_NAME = 'expense-tracker-' + CACHE_VERSION;
const FONT_CACHE  = 'expense-tracker-fonts-v1';

// App shell — offline launch এর জন্য এগুলো অবশ্যই cached থাকতে হবে
const APP_SHELL = [
  '/expense-tracker/',
  '/expense-tracker/index.html',
  '/expense-tracker/manifest.json',
  '/expense-tracker/icon-192.png',
  '/expense-tracker/icon-512.png'
];

// ── Install ───────────────────────────────────────────────────────────────────
// প্রতিটি asset আলাদাভাবে cache করা হচ্ছে।
// cache.addAll() ব্যবহার করলে একটি fail হলে সব বাতিল হয়ে যায়।
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        Promise.all(
          APP_SHELL.map(url =>
            cache.add(url).catch(err =>
              console.warn('[SW] Could not cache:', url, err)
            )
          )
        )
      )
      .then(() =>
        // Google Fonts — best-effort, offline install এ fail হলে skip
        caches.open(FONT_CACHE).then(fc =>
          fc.add(
            'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap'
          ).catch(() => {})
        )
      )
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
// পুরনো version এর cache মুছে দাও, font cache রেখে দাও
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME && k !== FONT_CACHE)
            .map(k => {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // ① Google Apps Script — network only
  //    offline হলে JSON error response দাও, app hang করবে না
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

  // ② Google Fonts — Cache First
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONT_CACHE).then(fc =>
        fc.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request)
            .then(resp => {
              if (resp && resp.status === 200) fc.put(event.request, resp.clone());
              return resp;
            })
            .catch(() => new Response('', { status: 408 }));
        })
      )
    );
    return;
  }

  // ③ App shell — CACHE FIRST (Stale-While-Revalidate)
  //
  //    এটাই মূল fix:
  //    - Cache এ থাকলে সাথে সাথে serve করো — network এর জন্য অপেক্ষা নেই
  //    - Background এ network থেকে update নাও (online হলে)
  //    - এর ফলে অনেক দিন offline থাকলেও app launch হবে
  //
  if (
    event.request.mode === 'navigate' ||
    url.includes('/expense-tracker/')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {

          // Background network revalidation — online থাকলে silently cache update
          const networkUpdate = fetch(event.request)
            .then(resp => {
              if (resp && resp.status === 200) {
                cache.put(event.request, resp.clone());
              }
              return resp;
            })
            .catch(() => null);

          // Cache hit → সাথে সাথে return করো, network এর জন্য অপেক্ষা নেই
          if (cached) {
            return cached;
          }

          // Cache miss → network এর জন্য wait করো
          return networkUpdate.then(resp => {
            if (resp) return resp;
            // Network ও নেই — index.html fallback
            return (
              cache.match('/expense-tracker/index.html') ||
              cache.match('/expense-tracker/')
            );
          });
        })
      )
    );
    return;
  }

  // ④ অন্য সব request — Network First, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp && resp.status === 200) {
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, resp.clone()));
        }
        return resp;
      })
      .catch(() =>
        caches.match(event.request).then(cached =>
          cached || caches.match('/expense-tracker/index.html')
        )
      )
  );
});
