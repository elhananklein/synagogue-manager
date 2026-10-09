/** חצי שעה לפני עלות השחר — תחילת החלון. */
export const NETZ_LEAD_MS = 30 * 60 * 1000;
/** עשר דקות אחרי הנץ — סוף החלון. */
export const NETZ_TAIL_MS = 10 * 60 * 1000;

export type NetzPhase = "before" | "after";

/** `?previewNetz=before` לפני הנץ, `?previewNetz=after` אחריו. */
export function parseNetzPreviewPhase(value: string | null | undefined): NetzPhase | null {
  return value === "before" || value === "after" ? value : null;
}

const PREVIEW_COUNTDOWN_MS = (18 * 60 + 42) * 1000;
const PREVIEW_ELAPSED_MS = (6 * 60 + 15) * 1000;

/** שעון קבוע לבדיקה, שמתקדם לפי העוגן שנקבע בטעינה. */
export function previewNetzClock(phase: NetzPhase, nowMs: number, anchorMs: number): NetzClock {
  const sunriseMs = phase === "before" ? anchorMs + PREVIEW_COUNTDOWN_MS : anchorMs - PREVIEW_ELAPSED_MS;
  const alotMs = sunriseMs - 72 * 60 * 1000;
  const clockMs = phase === "before" ? Math.max(0, sunriseMs - nowMs) : Math.max(0, nowMs - sunriseMs);
  return {
    phase,
    clockMs,
    alotIso: new Date(alotMs).toISOString(),
    sunriseIso: new Date(sunriseMs).toISOString()
  };
}

export function previewNetzPlaceholder(phase: NetzPhase): NetzClock {
  return {
    phase,
    clockMs: phase === "before" ? PREVIEW_COUNTDOWN_MS : PREVIEW_ELAPSED_MS,
    alotIso: "",
    sunriseIso: ""
  };
}

export type NetzClock = {
  phase: NetzPhase;
  /** אלפיות שמוצגות על השעון: עד הנץ, או מאז הנץ. */
  clockMs: number;
  alotIso: string;
  sunriseIso: string;
};

function parseIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** גבולות החלון: חצי שעה לפני עלות השחר עד עשר דקות אחרי הנץ. null = אין זמנים תקינים. */
export function netzWindowBounds(
  sourceTimes: Record<string, string> | null | undefined
): { startMs: number; endMs: number } | null {
  const alotMs = parseIso(sourceTimes?.alotHaShachar);
  const sunriseMs = parseIso(sourceTimes?.sunrise);
  if (alotMs == null || sunriseMs == null || sunriseMs <= alotMs) return null;
  return { startMs: alotMs - NETZ_LEAD_MS, endMs: sunriseMs + NETZ_TAIL_MS };
}

/**
 * חלון לוח הנץ לפי זמני Hebcal שכבר נטענו.
 * לפני הנץ — ספירה לאחור. מהנץ ועד עשר דקות אחריו — ספירה קדימה.
 * מחוץ לחלון, או בלי זמנים תקינים — אין מסך.
 */
export function resolveNetzClock(
  nowMs: number,
  sourceTimes: Record<string, string> | null | undefined
): NetzClock | null {
  const alotIso = sourceTimes?.alotHaShachar;
  const sunriseIso = sourceTimes?.sunrise;
  const alotMs = parseIso(alotIso);
  const sunriseMs = parseIso(sunriseIso);
  if (alotMs == null || sunriseMs == null || !alotIso || !sunriseIso || sunriseMs <= alotMs) return null;

  const startMs = alotMs - NETZ_LEAD_MS;
  const endMs = sunriseMs + NETZ_TAIL_MS;
  if (nowMs < startMs || nowMs >= endMs) return null;

  if (nowMs < sunriseMs) {
    return { phase: "before", clockMs: sunriseMs - nowMs, alotIso, sunriseIso };
  }

  return { phase: "after", clockMs: nowMs - sunriseMs, alotIso, sunriseIso };
}

export function formatNetzDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
