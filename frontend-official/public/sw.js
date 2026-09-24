// ZAI CRM PWA Service Worker
const CACHE_NAME = "zai-pwa-v1";
const STATIC_ASSETS = [
  "/",
  "/favicon.ico",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API or websocket requests
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io") || event.request.method !== "GET") {
    return;
  }

  // Network-first strategy for app documents and scripts to always get the latest release
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
