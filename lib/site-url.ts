/**
 * כתובת הבסיס הציבורית של האתר — לקישורי איפוס סיסמה וכו'.
 * בפרוד: הגדירו NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
 * בדפדפן: אם אין env — משתמשים ב-window.location.origin.
 */
export function getPublicSiteUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}
