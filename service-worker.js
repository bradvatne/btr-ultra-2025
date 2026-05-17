// BTR Ultra service worker — offline-first race-day caching.
// Bump CACHE_NAME when you redeploy and want every installed client to refetch.
const CACHE_NAME = "btr-v2";

const PRECACHE = [
  "/",
  "/index.html",
  "/app.js",
  "/data.js",
  "/manifest.json",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/btr-ultra-60k-full.gpx",
  "/recon-abang-terunyan.gpx",
  "/recon-analysis.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll is atomic — if any 404s the whole install fails. Use individual adds
      // so a stray missing asset doesn't lock out the user.
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {
            // swallow individual fetch failures during install
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Strategy:
//   - HTML navigations: network-first, fall back to cache (so a redeploy reaches
//     users while online, but the app still launches offline).
//   - Same-origin static assets: cache-first, populate cache on miss.
//   - Cross-origin (Tailwind CDN, Leaflet, OSM tiles): pass through; browser HTTP
//     cache handles them. Opaque responses can't be safely cached anyway.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Don't touch cross-origin requests — let the network/browser cache handle them.
  if (url.origin !== self.location.origin) return;

  // HTML navigation: network-first.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return resp;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/index.html")))
    );
    return;
  }

  // Everything else same-origin: cache-first.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((resp) => {
        if (resp.ok && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return resp;
      });
    })
  );
});

// Allow the page to ask the SW to clear its cache (used by a "force refresh" button if added).
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
  if (event.data === "clearCache") {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
});
