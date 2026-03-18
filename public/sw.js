// Minimal service worker for PWA installability
const CACHE = "ledger-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-first for API, cache for static assets
  if (event.request.url.includes("/api/")) {
    return;
  }
  event.respondWith(fetch(event.request));
});
