/* Service worker — נדרש ב-Android Chrome ליצירת WebAPK (אפליקציה) ולא רק קיצור דרך. */
const CACHE = "synagogue-shell-v2";
const OFFLINE_URLS = ["/admin/login", "/icons/admin-icon-192.png", "/icons/admin-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // ניווטים: רשת תחילה, עם גיבוי מינימלי כדי שה-fetch handler ייחשב "אמיתי".
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/admin/login");
        return cached || Response.error();
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // שומרים אייקונים בלבד (לא HTML דינמי).
        if (response.ok && request.url.includes("/icons/")) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
