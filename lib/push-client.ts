/** עזרי לקוח להרשמת Web Push — דפדפן בלבד */

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function fetchVapidPublicKey() {
  const res = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
  const data = (await res.json()) as { ok?: boolean; publicKey?: string };
  if (!data.ok || !data.publicKey) return null;
  return data.publicKey;
}

export async function subscribeToPush(synagogueId: string, minyanId: string | null) {
  if (!pushSupported()) throw new Error("unsupported");
  const registration = await navigator.serviceWorker.ready;
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
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
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
