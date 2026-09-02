/** מזהה בית כנסת בכתובת / בעוגייה — אותיות, ספרות ומקפים בלבד. */
export const SYNAGOGUE_ID_RE = /^[a-z0-9-]{3,40}$/i;

export const SYNAGOGUE_ID_COOKIE = "synagogue_id";
export const SYNAGOGUE_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export function parseSynagogueId(raw: string | null | undefined): string | null {
  const id = String(raw ?? "").trim().toLowerCase();
  return SYNAGOGUE_ID_RE.test(id) ? id : null;
}

/** שומר את בית הכנסת בעוגייה ציבורית (זמינה גם ב-middleware בכניסה הבאה). */
export function setSynagogueIdCookie(raw: string) {
  if (typeof document === "undefined") return;
  const id = parseSynagogueId(raw);
  if (!id) return;
  document.cookie = `${SYNAGOGUE_ID_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${SYNAGOGUE_ID_COOKIE_MAX_AGE}; SameSite=Lax`;
}
