/* Lò Hán service worker: app-shell precache, runtime cache for audio/hanzi */
const CACHE = "lohan-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./audio/index.json", "./hanzi-data/index.json"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })).map((r, i) => SHELL[i]).map((u) => u));
    try { await cache.addAll(SHELL); } catch (e) { /* one missing is ok */ }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) {
      // stale-while-revalidate for html/js/css
      const dest = req.destination;
      if (dest === "document" || dest === "script" || dest === "style") {
        event.waitUntil(fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); }).catch(() => {}));
      }
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === "navigate" || req.destination === "document") {
        const shell = await cache.match("./index.html") || await cache.match("./");
        if (shell) return shell;
      }
      throw err;
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PRECACHE_ALL") {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const list = event.data.urls || [];
      let ok = 0;
      for (const u of list) {
        try { await cache.add(u); ok++; } catch (e) {}
      }
      const clients = await self.clients.matchAll();
      for (const c of clients) c.postMessage({ type: "PRECACHE_DONE", ok, total: list.length });
    })());
  }
});
