/* Miaozi service worker */
const VERSION = "2.3.0";
const SHELL_CACHE = "miaozi-shell-" + VERSION;
const DATA_CACHE = "miaozi-data-4"; // âm thanh, nét chữ, font — đổi số khi dữ liệu đổi
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./favicon.ico", "./miao/vui.webp", "./miao/dac_y.webp", "./miao/ngai_ngu.webp", "./miao/kho_chiu.webp", "./miao/cau.webp", "./miao/quan_tam.webp", "./miao/nghi_ngo.webp", "./miao/cuoi_khinh_bi.webp"];
const FRESH = /\/(audio|hanzi-data)\/index\.json$/;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    for (const u of SHELL) { try { await cache.add(new Request(u, { cache: "reload" })); } catch (e) { /* bỏ qua */ } }
    // Lần cài đầu tiên: kích hoạt ngay. Khi cập nhật: chờ người dùng bấm "Tải lại".
    // Bản 1.0 cũ không có nút "Tải lại" → nâng cấp thẳng.
    if (!self.registration.active || (await caches.has("lohan-v1"))) self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d.type === "SKIP_WAITING") self.skipWaiting();
  if (d.type === "PRECACHE_ALL") {
    event.waitUntil((async () => {
      const cache = await caches.open(DATA_CACHE);
      const list = d.urls || [];
      let ok = 0;
      for (const u of list) {
        try { if (!(await cache.match(u))) await cache.add(u); ok++; } catch (e) { /* */ }
      }
      const clients = await self.clients.matchAll();
      for (const c of clients) c.postMessage({ type: "PRECACHE_DONE", ok, total: list.length });
    })());
  }
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") {
      const shell = (await cache.match("./index.html")) || (await cache.match("./"));
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (req.mode === "navigate" || p.endsWith("/index.html") || p.endsWith("/manifest.webmanifest") || FRESH.test(p)) {
    event.respondWith(networkFirst(req, FRESH.test(p) ? DATA_CACHE : SHELL_CACHE));
  } else if (/\/(audio|hanzi-data|fonts)\//.test(p)) {
    event.respondWith(cacheFirst(req, DATA_CACHE));
  } else {
    // js/css có hash trong tên: cache-first là an toàn
    event.respondWith(cacheFirst(req, SHELL_CACHE));
  }
});
