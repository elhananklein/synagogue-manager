import { getHolidaysOnDate, HDate, flags } from "@hebcal/core";
import { aliyahDayKind, parashaOrChagLabel, saturdayOnOrAfter } from "@/lib/aliyah-slots";
import { parseIsoDate } from "@/lib/hebrew-civil-date";

function stripHebrewNiqqud(text: string) {
  return text.replace(/[\u0591-\u05C7]/g, "");
}

function hdateFromIso(isoDate: string) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return null;
  return new HDate(new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0));
}

function jsWeekdayFromIso(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

/** יום טוב (לא ערב חג) — כולל כשחל בשבת. */
export function isChagOnDate(isoDate: string): boolean {
  const hd = hdateFromIso(isoDate);
  if (!hd) return false;
  return (getHolidaysOnDate(hd, true) ?? []).some((ev) => {
    const eventFlags = ev.getFlags();
    if (eventFlags & flags.EREV) return false;
    return Boolean(eventFlags & flags.CHAG);
  });
}

/** מסך סדר השבת/החג: שישי, שבת, או יום טוב באמצע השבוע. */
export function isOccasionScreenDay(isoDate: string): boolean {
  const weekday = jsWeekdayFromIso(isoDate);
  if (weekday === 5 || weekday === 6) return true;
  return isChagOnDate(isoDate);
}

export function weeklyOccasionIso(fromIso: string) {
  return saturdayOnOrAfter(fromIso);
}

function cleanOccasionLabel(raw: string): string {
  return stripHebrewNiqqud(raw)
    .replace(/\s+\d{3,4}\s*$/g, "")
    .replace(/^[א-ב]['׳]?\s+/u, "")
    .replace(/\s+[א-ב]['׳]?$/u, "")
    .replace(/יום כפור/g, "יום כיפור")
    .replace(/סכות/g, "סוכות")
    .trim();
}

/** שם לתצוגה: פרשת השבוע, או שם החג כשאין קריאה שבועית. */
export function resolveOccasionLabel(isoDate: string): string {
  const kind = aliyahDayKind(isoDate);
  return cleanOccasionLabel(parashaOrChagLabel(isoDate, kind));
}

export function applyOccasionDisplayLabel(weeklyParashaFromApi: string | null | undefined, occasionIso: string): string {
  if (isChagOnDate(occasionIso)) {
    const holiday = resolveOccasionLabel(occasionIso);
    if (holiday) return holiday;
  }
  const fromApi = weeklyParashaFromApi?.trim() ?? "";
  if (fromApi && fromApi !== "לא נמצא") return cleanOccasionLabel(fromApi);
  return resolveOccasionLabel(occasionIso);
}
