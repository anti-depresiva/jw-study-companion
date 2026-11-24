/* JW+ Study Companion – Service Worker
 * Macht die App offline nutzbar. Persönliche Daten liegen in IndexedDB,
 * nicht im Cache. Pfade relativ zum Scope (GitHub Pages: /<repo>/).
 */
const VERSION = "jwps-v2";
const CACHE = `${VERSION}-app`;
const scope = self.registration.scope;
const PRECACHE = ["", "offline/", "icons/icon-192.png"].map((p) => new URL(p, scope).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(scope)) return;

  // Seiten: zuerst Netz (für Updates), offline aus dem Cache
  if (req.mode === "navigate") {
    const key = url.origin + url.pathname; // ohne ?y=…&w=… – die Seiten laden ihre Daten selbst
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key).then((hit) => hit || caches.match(new URL("offline/", scope).toString()))),
    );
    return;
  }

  // Skripte, Styles, Schriften, Icons: Cache zuerst
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
