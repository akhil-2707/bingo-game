/* Bingo Master PWA Service Worker */
const CACHE_NAME = 'bingo-master-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/katam_kutta_3d_banner.png',
  '/assets/grid_battle_3d_banner.png',
  '/assets/friends_multiplayer_3d_banner.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
