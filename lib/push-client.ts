/** עזרי לקוח להרשמת Web Push — דפדפן בלבד */

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Push עובד רק ב־HTTPS, או ב־localhost במחשב הפיתוח — לא ב־http://כתובת-IP בטלפון */
export function pushSecureContext() {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushEnableBlockReason(): "insecure" | "unsupported" | "ios_browser" | null {
  if (!pushSecureContext()) return "insecure";
  if (!pushSupported()) return "unsupported";
  const ua = navigator.userAgent || "";
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
  if (isIos && !standalone) return "ios_browser";
  return null;
}

export async function fetchVapidPublicKey() {
  const res = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
  const data = (await res.json()) as { ok?: boolean; publicKey?: string; error?: string };
  if (!data.ok || !data.publicKey) return null;
  return data.publicKey;
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("unsupported");
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) {
    await navigator.serviceWorker.ready;
    return existing;
  }
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none"
  });
  await navigator.serviceWorker.ready;
  return registration;
}

export async function subscribeToPush(synagogueId: string, minyanId: string | null) {
  const block = pushEnableBlockReason();
  if (block === "insecure") throw new Error("insecure");
  if (block === "ios_browser") throw new Error("ios_browser");
  if (block === "unsupported" || !pushSupported()) throw new Error("unsupported");

  const registration = await ensureServiceWorker();
  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) throw new Error("missing_vapid");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) throw new Error("invalid_subscription");

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ synagogueId, minyanId, endpoint, keys: { p256dh, auth } })
  });
  const payload = (await res.json()) as { ok?: boolean; error?: string };
  if (!payload.ok) throw new Error(payload.error || "save_failed");
  return subscription;
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint })
  });
  await subscription.unsubscribe();
}

export async function currentPushSubscription() {
  if (!pushSupported() || !pushSecureContext()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

const BANNER_DISMISS_KEY = "push-banner-dismissed";

export function pushBannerDismissed(synagogueId: string) {
  try {
    return localStorage.getItem(`${BANNER_DISMISS_KEY}:${synagogueId}`) === "1";
  } catch {
    return false;
  }
}

export function dismissPushBanner(synagogueId: string) {
  try {
    localStorage.setItem(`${BANNER_DISMISS_KEY}:${synagogueId}`, "1");
  } catch {
    /* ignore */
  }
}

export function pushErrorMessage(code: string) {
  const map: Record<string, string> = {
    insecure:
      "התראות עובדות רק באתר מאובטח (https). בטלפון אי אפשר להפעיל דרך כתובת הרשת המקומית (http://10…). בדקו בכתובת של Vercel, או אחרי התקנת האפליקציה משם.",
    ios_browser: "באייפון: הוסיפו את האתר למסך הבית («Share» ← Add to Home Screen), ואז פתחו משם ואשרו התראות.",
    unsupported: "הדפדפן לא תומך בהתראות. באנדרואיד עדיף Chrome אחרי התקנת האפליקציה.",
    denied: "ההרשאה להתראות נחסמה. אפשר לאפשר בהגדרות הדפדפן/הטלפון.",
    missing_vapid: "חסרים מפתחות התראות בשרת (VAPID). צריך להגדיר אותם ב־Vercel.",
    missing_push_tables: "חסרות טבלאות במסד. הריצו supabase/push-notifications-migration.sql",
    push_not_enabled: "התראות לא פעילות לבית הכנסת הזה.",
    invalid_subscription: "הדפדפן לא החזיר מנוי תקין. נסו לרענן ולהתקין מחדש.",
    save_failed: "שמירת המנוי נכשלה. נסו שוב."
  };
  return map[code] || `לא הצלחנו להפעיל התראות (${code}). נסו שוב.`;
}
