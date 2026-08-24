/*
  The minimum service worker, not a full offline app.

  Chrome's install criteria on desktop require an active service worker
  with a fetch handler — without one, "Add to Home Screen" never offers
  itself even with a complete manifest. This exists to satisfy that, and
  to make the small set of static, unchanging assets (icons, the
  manifest itself) load instantly and work offline.

  Everything else — every page, every API call — passes straight to the
  network. MIDO XI is a live dashboard: match data, recovery scores,
  session proposals. Caching an HTML shell and letting somebody read
  yesterday's recovery number as if it were today's would be exactly the
  kind of invented state this product's data model is built to avoid.
  Real offline support — a queue for actions taken while disconnected,
  a deliberate "you're viewing a cached copy" indicator — is a project
  of its own, not a byproduct of installability.
*/

const CACHE = "mido-xi-static-v1";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
    );
  }
  // Everything else: no respondWith call at all, so the browser's
  // default network handling applies untouched.
});
