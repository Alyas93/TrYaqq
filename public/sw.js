/* ترياق — Service Worker للنسخة المنشورة (ملف واحد)
   الملف الوحيد الثقيل هو index.html، فيُخزَّن كاملاً ليعمل التطبيق بلا إنترنت. */
const CACHE = "tiryaq-pages-v1";
const CORE  = ["./", "./index.html", "./manifest.json",
               "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))
    .then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;          /* لا نتدخّل في طلبات الذكاء والمزامنة */
  /* الشبكة أولاً ليصل التحديث، والكاش عند انقطاعها */
  e.respondWith(
    fetch(e.request).then(r => {
      const c = r.clone();
      caches.open(CACHE).then(x => x.put(e.request, c)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match("./index.html")))
  );
});
