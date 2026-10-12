// ChopNow Rider — Service Worker
//
// Scope is deliberately minimal for this sprint: cache the app shell so
// the PWA is installable and the last-loaded screen renders instantly
// on reopen, even on a flaky connection between deliveries. This is NOT
// a full offline-data strategy — order data, dispatch offers, and
// location pings all require a live connection and are not cached here,
// since serving stale delivery data offline would be actively dangerous
// (a rider acting on an outdated order state is worse than a loading
// spinner). Push notifications for new delivery offers are a natural
// next addition to this file once a push provider is wired in.

const CACHE_NAME = "chopnow-rider-shell-v1";
const APP_SHELL = ["/", "/deliveries", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match("/")),
    ),
  );
});
