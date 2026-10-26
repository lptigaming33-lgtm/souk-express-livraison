// SOUK EXPRESS AGADIR - PWA Service Worker
// Strictly caches only public static assets & offline shell.
// NEVER caches /api/*, private account data, or sensitive order responses.

const CACHE_NAME = "souk-express-static-v1";
const STATIC_ASSETS = [
  "/offline",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NEVER cache non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // 2. NEVER cache API endpoints or private role routes in shared cache
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/driver") ||
    url.pathname.startsWith("/partner")
  ) {
    return;
  }

  // 3. For navigation requests, try network first and fall back to /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline"))
    );
    return;
  }

  // 4. For static icons/fonts, use cache-first with network fallback
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
