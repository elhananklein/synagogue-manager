import { getHolidaysOnDate, HDate, flags } from "@hebcal/core";
import { parashaOrChagLabel, saturdayOnOrAfter } from "@/lib/aliyah-slots";
import { parseIsoDate } from "@/lib/hebrew-civil-date";

export const OCCASION_DAY_MAX = 3;
export type OccasionDayIndex = 1 | 2 | 3;

export type OccasionAgendaDayMeta = {
  day: OccasionDayIndex;
  iso: string;
  title: string;
  weekdayLabel: string;
  hebrewDate: string;
  weekdayChag: boolean;
  /** יום טוב, גם כשחל בשבת */
  isChag: boolean;
  isSaturday: boolean;
  isLastDay: boolean;
};

export type OccasionCluster = {
  erevIso: string;
  days: OccasionAgendaDayMeta[];
};

function stripHebrewNiqqud(text: string) {
  return text.replace(/[\u0591-\u05C7]/g, "");
}

function hdateFromIso(isoDate: string) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return null;
  return new HDate(new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0));
}

export function jsWeekdayFromIso(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function addDaysIso(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekdayLong(isoDate: string) {
  if (jsWeekdayFromIso(isoDate) === 6) return "שבת";
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${isoDate}T12:00:00Z`)
  );
}

function hebrewDateLabel(isoDate: string) {
  const hd = hdateFromIso(isoDate);
  if (!hd) return "";
  try {
    const rendered = hd.renderGematriya(true);
    return typeof rendered === "string" ? stripHebrewNiqqud(rendered) : "";
  } catch {
    return "";
  }
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

/** יום שבתון: שבת או יום טוב. */
export function isShabbatonDate(isoDate: string): boolean {
  return jsWeekdayFromIso(isoDate) === 6 || isChagOnDate(isoDate);
}

/** היום האזרחי שלפני רצף שבתון — כמו ערב שבת. */
export function isErevShabbatonDate(isoDate: string): boolean {
  return !isShabbatonDate(isoDate) && isShabbatonDate(addDaysIso(isoDate, 1));
}

export function normalizeOccasionDay(value: unknown): OccasionDayIndex {
  const n = Number(value);
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

/** מסך סדר השבת/החג: שישי, שבת, יום טוב, או ערב היום הראשון ברצף. */
export function isOccasionScreenDay(isoDate: string): boolean {
  const weekday = jsWeekdayFromIso(isoDate);
  if (weekday === 5 || weekday === 6) return true;
  return isChagOnDate(isoDate) || isErevShabbatonDate(isoDate);
}

/** המועד הקרוב לתצוגה: חג שחל לפני השבת — החג; אחרת השבת הקרובה. */
export function weeklyOccasionIso(fromIso: string) {
  const cluster = resolveOccasionCluster(fromIso);
  return (
    cluster.days.find((day) => day.isChag)?.iso ??
    cluster.days.find((day) => day.isSaturday)?.iso ??
    saturdayOnOrAfter(fromIso)
  );
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
  return cleanOccasionLabel(parashaOrChagLabel(isoDate));
}

/** כיתוב ליום בלוח: ערב שבת/חג, שם החג, שבת, או יום חול. */
export function dayOccasionCaption(isoDate: string): string {
  if (isErevShabbatonDate(isoDate)) return erevOccasionTitle(isoDate);
  if (isChagOnDate(isoDate)) {
    const holiday = resolveOccasionLabel(isoDate);
    if (holiday) return holiday;
  }
  return weekdayLong(isoDate);
}

function holidaySearchText(isoDate: string): string {
  const hd = hdateFromIso(isoDate);
  if (!hd) return "";
  return (getHolidaysOnDate(hd, true) ?? [])
    .filter((ev) => !(ev.getFlags() & flags.EREV))
    .map((ev) => {
      let hebrew = "";
      try {
        hebrew = String(ev.render("he") ?? "");
      } catch {
        hebrew = "";
      }
      return `${ev.getDesc()} ${hebrew}`;
    })
    .join(" ");
}

function holidayFlagsOn(isoDate: string): number {
  const hd = hdateFromIso(isoDate);
  if (!hd) return 0;
  return (getHolidaysOnDate(hd, true) ?? []).reduce((acc, ev) => {
    const eventFlags = ev.getFlags();
    if (eventFlags & flags.EREV) return acc;
    return acc | eventFlags;
  }, 0);
}

/**
 * ברכה לאריח הפרשה במסך הראשי המצומצם (ערב שבת/חג, שבת, חג).
 * ערב נמדד לפי היום הבא.
 */
export function occasionGreeting(isoDate: string): string | null {
  const focusIso = isErevShabbatonDate(isoDate) ? addDaysIso(isoDate, 1) : isoDate;
  const text = stripHebrewNiqqud(holidaySearchText(focusIso));
  const eventFlags = holidayFlagsOn(focusIso);
  const isSaturday = jsWeekdayFromIso(focusIso) === 6;
  const isChag = Boolean(eventFlags & flags.CHAG);

  if (isChag && eventFlags & flags.MAJOR_FAST) return "גמר חתימה טובה";
  if (/Rosh\s*Hashan|ראש השנה/i.test(text)) return "שנה טובה";
  if (/Pesach|פסח/i.test(text) && (isChag || eventFlags & flags.CHOL_HAMOED)) {
    return "חג כשר ושמח";
  }
  if (isChag) return isSaturday ? "שבת שלום וחג שמח" : "חג שמח";
  if (eventFlags & flags.CHOL_HAMOED) {
    return isSaturday ? "שבת שלום וחג שמח" : "חג שמח";
  }
  if (isSaturday) return "שבת שלום";
  return null;
}

/** כותרת לערב שבתון: «ערב יום כיפור», «ערב סוכות», או «ערב שבת». */
export function erevOccasionTitle(erevIso: string): string {
  const nextIso = addDaysIso(erevIso, 1);
  if (isChagOnDate(nextIso)) {
    const holiday = resolveOccasionLabel(nextIso);
    if (!holiday) return "ערב חג";
    return /^ערב\s/.test(holiday) ? holiday : `ערב ${holiday}`;
  }
  return "ערב שבת";
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

const DAY_ORDINALS = ["יום א׳", "יום ב׳", "יום ג׳"] as const;

function occasionDayHeading(iso: string, day: OccasionDayIndex, totalDays: number): string {
  const isSaturday = jsWeekdayFromIso(iso) === 6;
  const isChag = isChagOnDate(iso);
  const holiday = isChag ? resolveOccasionLabel(iso) : "";
  if (totalDays <= 1) {
    return isChag ? holiday || "יום טוב" : "";
  }
  const ordinal = DAY_ORDINALS[day - 1] ?? `יום ${day}`;
  if (isSaturday && !isChag) return "שבת";
  if (isChag && holiday) {
    if (isSaturday) return `${holiday} · שבת`;
    return `${holiday} · ${ordinal}`;
  }
  return ordinal;
}

function nextShabbatonIso(fromIso: string) {
  for (let offset = 0; offset <= 10; offset += 1) {
    const iso = addDaysIso(fromIso, offset);
    if (isShabbatonDate(iso)) return iso;
  }
  return saturdayOnOrAfter(fromIso);
}

function clusterStartIso(anchorIso: string) {
  let start = anchorIso;
  for (let step = 0; step < OCCASION_DAY_MAX - 1; step += 1) {
    const prev = addDaysIso(start, -1);
    if (!isShabbatonDate(prev)) break;
    start = prev;
  }
  return start;
}

function shabbatonIsosFrom(startIso: string) {
  const days: string[] = [];
  let cur = startIso;
  for (let i = 0; i < OCCASION_DAY_MAX; i += 1) {
    if (!isShabbatonDate(cur)) break;
    days.push(cur);
    cur = addDaysIso(cur, 1);
  }
  return days;
}

/** רצף ימי שבתון הקרוב ל־fromIso (עד 3). ערב = היום שלפני יום 1. */
export function resolveOccasionCluster(fromIso: string): OccasionCluster {
  const anchor = isShabbatonDate(fromIso)
    ? fromIso
    : isErevShabbatonDate(fromIso)
      ? addDaysIso(fromIso, 1)
      : nextShabbatonIso(fromIso);
  const isos = shabbatonIsosFrom(clusterStartIso(anchor));
  const total = isos.length || 1;
  const days: OccasionAgendaDayMeta[] = (isos.length ? isos : [saturdayOnOrAfter(fromIso)]).map((iso, index) => {
    const day = normalizeOccasionDay(index + 1);
    const isSaturday = jsWeekdayFromIso(iso) === 6;
    const isChag = isChagOnDate(iso);
    return {
      day,
      iso,
      title: occasionDayHeading(iso, day, total),
      weekdayLabel: weekdayLong(iso),
      hebrewDate: hebrewDateLabel(iso),
      weekdayChag: Boolean(isChag && !isSaturday),
      isChag,
      isSaturday,
      isLastDay: day === total
    };
  });
  return {
    erevIso: addDaysIso(days[0]!.iso, -1),
    days
  };
}

export function preferredOccasionDayIndex(viewIso: string, cluster: OccasionCluster): OccasionDayIndex {
  if (viewIso === cluster.erevIso) return 1;
  const match = cluster.days.find((item) => item.iso === viewIso);
  return match?.day ?? 1;
}
