/* Service worker — נדרש ב-Android Chrome ליצירת WebAPK (אפליקציה) ולא רק קיצור דרך. */
const CACHE = "synagogue-shell-v6";
const OFFLINE_URLS = ["/admin/login", "/icons/admin-icon-192.png", "/icons/admin-icon-512.png"];
const DISPLAY_LAST = "/__display-last";
const DISPLAY_NAV_TIMEOUT_MS = 12000;

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

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isDisplayPath(url) {
  return url.pathname === "/display" || url.pathname.startsWith("/display/");
}

function isTvRequest(request) {
  const ua = request.headers.get("User-Agent") || "";
  return /TV|SmartTV|Smart-TV|BRAVIA|AFT[A-Z0-9]|GoogleTV|CrKey|HbbTV|Web0S|Tizen|VIDAA|Hisense|NetCast|Android TV|AppleTV|Fire TV/i.test(
    ua
  );
}

function isMobileRequest(request) {
  if (isTvRequest(request)) return false;
  const ch = request.headers.get("Sec-CH-UA-Mobile");
  const ua = request.headers.get("User-Agent") || "";
  if (/iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua) && !/iPad/i.test(ua)) return true;
  if (ch === "?1" && /Mobile/i.test(ua)) return true;
  return false;
}

function isDisplayHtmlGet(request) {
  const url = new URL(request.url);
  if (!isDisplayPath(url)) return false;
  const accept = request.headers.get("Accept") || "";
  if (accept.includes("text/x-component")) return false;
  if (request.mode === "navigate") return true;
  return accept.includes("text/html");
}

function shouldBypass(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return true;
  const accept = request.headers.get("Accept") || "";
  return accept.includes("text/x-component");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (shouldBypass(request)) return;

  // ניווטים: רשת תחילה, עם גיבוי מינימלי כדי שה-fetch handler ייחשב "אמיתי".
  if (request.mode === "navigate") {
    const url = new URL(request.url);
    const displayNav = isDisplayPath(url);

    event.respondWith(
      (async () => {
        const mobileNav = isMobileRequest(request);
        try {
          const res = await fetchWithTimeout(
            request,
            displayNav && !mobileNav ? DISPLAY_NAV_TIMEOUT_MS : 20000
          );
          if (displayNav && res.ok && !mobileNav) {
            const cache = await caches.open(CACHE);
            await cache.put(DISPLAY_LAST, res.clone());
            return res;
          }
          if (displayNav && !res.ok && !mobileNav) {
            const cache = await caches.open(CACHE);
            const cached = await cache.match(DISPLAY_LAST);
            if (cached) return cached;
          }
          return res;
        } catch {
          if (displayNav && !mobileNav) {
            const cache = await caches.open(CACHE);
            const cached = await cache.match(DISPLAY_LAST);
            if (cached) return cached;
            return Response.error();
          }
          const cached = await caches.match("/admin/login");
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE);
        if (response.ok && request.url.includes("/icons/")) {
          await cache.put(request, response.clone());
        }
        if (response.ok && isDisplayHtmlGet(request) && !isMobileRequest(request)) {
          await cache.put(DISPLAY_LAST, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) || Response.error();
      }
    })()
  );
});
