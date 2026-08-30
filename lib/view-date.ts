import { addDaysIsoDate, toIsoDateJerusalem } from "@/lib/hebcal";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const VIEW_DATE_RANGE_DAYS = 21;

export function daysBetweenIso(fromIso: string, toIso: string) {
  const [y1, m1, d1] = fromIso.split("-").map(Number);
  const [y2, m2, d2] = toIso.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
}

export function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && ISO_DATE_RE.test(value));
}

export function resolveViewIsoDate(requested: string | null | undefined, todayIso = toIsoDateJerusalem()) {
  if (!isIsoDate(requested)) return todayIso;
  const diff = daysBetweenIso(todayIso, requested);
  if (diff < -VIEW_DATE_RANGE_DAYS || diff > VIEW_DATE_RANGE_DAYS) return todayIso;
  return requested;
}

export function hebrewWeekdayLong(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (date.getUTCDay() === 6) return "שבת";
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "UTC" }).format(date);
}

export function relativeDayLabel(isoDate: string, todayIso = toIsoDateJerusalem()) {
  const diff = daysBetweenIso(todayIso, isoDate);
  if (diff === 0) return "היום";
  if (diff === 1) return "מחר";
  if (diff === 2) return "מחרתיים";
  if (diff === -1) return "אתמול";
  if (diff === -2) return "שלשום";
  return hebrewWeekdayLong(isoDate);
}
