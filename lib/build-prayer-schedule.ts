import type { PrayerSetting, PrayerType } from "@/lib/display-config";
import {
  catalogTimeForLookup,
  parashaKeyMatchRank,
  type ParashaPrayerCatalogRow
} from "@/lib/parasha-prayer-catalog";

/** תווית תצוגה למנחה ערב שבת (כולל קבלת שבת) — במסד נשאר המפתח «מנחה ערב שבת». */
export const EREV_SHABBAT_DISPLAY_LABEL = "מנחה ערב שבת וקבלת שבת";

/** ימי א׳–ה׳ בלבד — שישי ושבת לא רלוונטיים לחוק "לפי פרשה". */
export function isParashaScheduleWeekday(jsDay: number) {
  return jsDay >= 0 && jsDay <= 4;
}

function displayLabelForPrayerType(prayerType: PrayerType | string): string {
  return prayerType === "מנחה ערב שבת" ? EREV_SHABBAT_DISPLAY_LABEL : prayerType;
}

function roundToFiveMinutes(date: Date, mode: "none" | "up" | "down") {
  if (mode === "none") return date;
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 5;
  if (remainder === 0) return rounded;
  if (mode === "up") {
    rounded.setMinutes(minutes + (5 - remainder), 0, 0);
    return rounded;
  }
  rounded.setMinutes(minutes - remainder, 0, 0);
  return rounded;
}

function formatWithOffset(baseIso: string, offsetMinutes: number, roundMode: "none" | "up" | "down") {
  const date = new Date(baseIso);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  const rounded = roundToFiveMinutes(date, roundMode);
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem"
  }).format(rounded);
}

/** עוגן יחסי: ערבית לפי זמן תפילת המנחה (נשמר ב־zman_anchor). */
export const ZMAN_ANCHOR_MINCHA = "mincha";

const MINUTES_IN_DAY = 24 * 60;

function parseHhmmToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatMinutesOfDay(totalMinutes: number): string {
  const normalized = ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function roundClockMinutes(totalMinutes: number, mode: "none" | "up" | "down"): number {
  const normalized = ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  if (mode === "none") return normalized;
  const minutes = normalized % 60;
  const remainder = minutes % 5;
  if (remainder === 0) return normalized;
  if (mode === "up") return (normalized + (5 - remainder)) % MINUTES_IN_DAY;
  return normalized - remainder;
}

function formatClockWithOffset(hhmm: string, offsetMinutes: number, roundMode: "none" | "up" | "down"): string | null {
  const base = parseHhmmToMinutes(hhmm);
  if (base == null) return null;
  return formatMinutesOfDay(roundClockMinutes(base + offsetMinutes, roundMode));
}

function isMinchaAnchoredMaariv(setting: PrayerSetting): boolean {
  return (
    setting.mode === "relative" &&
    setting.zmanAnchor === ZMAN_ANCHOR_MINCHA &&
    (setting.prayerType === "ערבית" || setting.prayerType === "ערבית מוצ'ש")
  );
}

function weekdaySettingsForDay(prayerSettings: PrayerSetting[], jsDay: number): PrayerSetting[] {
  const weekdaySettings = prayerSettings.filter((setting) => setting.category === "weekday");
  const forDay = weekdaySettings.filter(
    (setting) => !setting.daysOfWeek.length || setting.daysOfWeek.includes(jsDay)
  );
  return forDay.length ? forDay : weekdaySettings;
}

function isCatalogParashaMode(setting: PrayerSetting): boolean {
  return (
    setting.mode === "parasha" &&
    setting.category === "weekday" &&
    !setting.parashaKey?.trim() &&
    (setting.prayerType === "מנחה" || setting.prayerType === "ערבית")
  );
}

function catalogTimeForType(
  settings: PrayerSetting[],
  prayerType: "מנחה" | "ערבית",
  lookupKey: string | null,
  catalog: ParashaPrayerCatalogRow[] | null | undefined
): string | null {
  if (!settings.some((setting) => isCatalogParashaMode(setting) && setting.prayerType === prayerType)) {
    return null;
  }
  return catalogTimeForLookup(catalog, lookupKey, prayerType);
}

function parashaWinnerByType(
  settings: PrayerSetting[],
  parashaKeyForDay: string | null,
  jsDay: number
): Map<string, PrayerSetting> {
  const winners = new Map<string, PrayerSetting>();
  const ranks = new Map<string, number>();
  if (!parashaKeyForDay || parashaKeyForDay === "לא נמצא" || !isParashaScheduleWeekday(jsDay)) {
    return winners;
  }
  for (const setting of settings) {
    if (setting.mode !== "parasha" || !setting.parashaKey || !setting.fixedTime) continue;
    const rank = parashaKeyMatchRank(setting.parashaKey, parashaKeyForDay);
    if (rank == null) continue;
    const currentRank = ranks.get(setting.prayerType);
    if (currentRank != null && currentRank <= rank) continue;
    winners.set(setting.prayerType, setting);
    ranks.set(setting.prayerType, rank);
  }
  return winners;
}

function firstShabbatMinchaClockTime(
  shabbatSettings: PrayerSetting[],
  saturdayZmanim: Record<string, string>
): string | null {
  for (const setting of shabbatSettings) {
    if (setting.prayerType !== "מנחה שבת") continue;
    if (setting.mode === "fixed" && setting.fixedTime) return setting.fixedTime.slice(0, 5);
    if (setting.mode === "relative" && setting.zmanAnchor && setting.zmanAnchor in saturdayZmanim) {
      return formatWithOffset(
        saturdayZmanim[setting.zmanAnchor],
        setting.offsetMinutes ?? 0,
        setting.roundMode ?? "none"
      );
    }
  }
  return null;
}

function firstMinchaClockTime(
  settings: PrayerSetting[],
  zmanimSourceTimes: Record<string, string>,
  sundayZmanimSourceTimes: Record<string, string> | null | undefined,
  parashaKeyForDay: string | null,
  jsDay: number,
  catalog?: ParashaPrayerCatalogRow[] | null
): string | null {
  const winners = parashaWinnerByType(settings, parashaKeyForDay, jsDay);
  const winner = winners.get("מנחה");
  if (winner?.fixedTime) return winner.fixedTime.slice(0, 5);
  const catalogTime = catalogTimeForType(settings, "מנחה", parashaKeyForDay, catalog);
  if (catalogTime) return catalogTime;
  for (const setting of settings) {
    if (setting.prayerType !== "מנחה") continue;
    if (winners.get("מנחה")) continue;
    if (setting.mode === "parasha") continue;
    const row = resolveFixedOrRelativeRow(setting, zmanimSourceTimes, sundayZmanimSourceTimes);
    if (row) return row.time;
  }
  return null;
}

/** מנחה/ערבית של חול ביחס לזמן היום, עם נעילה לזמני יום ראשון. */
export function usesSundayLock(setting: PrayerSetting): boolean {
  return (
    Boolean(setting.lockToSunday) &&
    setting.mode === "relative" &&
    setting.category === "weekday" &&
    (setting.prayerType === "מנחה" || setting.prayerType === "ערבית")
  );
}

export function settingsNeedSundayZmanim(prayerSettings: PrayerSetting[]): boolean {
  return prayerSettings.some(usesSundayLock);
}

function resolveFixedOrRelativeRow(
  setting: PrayerSetting,
  zmanimSourceTimes: Record<string, string>,
  sundayZmanimSourceTimes?: Record<string, string> | null
): { label: string; time: string; details: string } | null {
  if (setting.mode === "fixed" && setting.fixedTime) {
    return {
      label: displayLabelForPrayerType(setting.prayerType),
      time: setting.fixedTime.slice(0, 5),
      details: ""
    };
  }
  if (setting.mode === "relative" && setting.zmanAnchor) {
    const times =
      usesSundayLock(setting) && sundayZmanimSourceTimes && setting.zmanAnchor in sundayZmanimSourceTimes
        ? sundayZmanimSourceTimes
        : zmanimSourceTimes;
    if (setting.zmanAnchor in times) {
      return {
        label: displayLabelForPrayerType(setting.prayerType),
        time: formatWithOffset(times[setting.zmanAnchor], setting.offsetMinutes ?? 0, setting.roundMode ?? "none"),
        details: ""
      };
    }
  }
  return null;
}

/**
 * בונה רשימת זמני תפילה ליום אחד.
 * `parashaKeyForDay` — אותה מחרוזת כמו `snapshot.parasha` מאותו יום (Hebcal); null = לא להפעיל התאמת פרשה.
 *
 * שישי: תפילות בוקר של חול + «מנחה ערב שבת וקבלת שבת» בלבד לערב (בלי מנחה/ערבית של חול).
 * שבת: תפילות קטגוריית שבת ללא «מנחה ערב שבת» (ששייכת ליום שישי).
 */
export function buildPrayerScheduleForDay(
  prayerSettings: PrayerSetting[],
  zmanimSourceTimes: Record<string, string>,
  jsDay: number,
  isShabbat: boolean,
  parashaKeyForDay: string | null,
  sundayZmanimSourceTimes?: Record<string, string> | null,
  parashaCatalog?: ParashaPrayerCatalogRow[] | null
): Array<{ label: string; time: string; details: string }> {
  const weekdaySettings = prayerSettings.filter((setting) => setting.category === "weekday");
  const shabbatSettings = prayerSettings.filter((setting) => setting.category === "shabbat");
  const weekdayForToday = weekdaySettings.filter(
    (setting) => !setting.daysOfWeek.length || setting.daysOfWeek.includes(jsDay)
  );
  const erevShabbatSettings = shabbatSettings.filter((setting) => setting.prayerType === "מנחה ערב שבת");
  const saturdayShabbatSettings = shabbatSettings.filter((setting) => setting.prayerType !== "מנחה ערב שבת");

  if (isShabbat || jsDay === 6) {
    // בשבת — רק תפילות שבת (בלי מנחה ערב שבת, ובלי נפילה חזרה לתפילות חול).
    const minchaShabbatTime = firstShabbatMinchaClockTime(saturdayShabbatSettings, zmanimSourceTimes);
    return saturdayShabbatSettings
      .map((setting) => {
        if (isMinchaAnchoredMaariv(setting)) {
          const time = minchaShabbatTime
            ? formatClockWithOffset(minchaShabbatTime, setting.offsetMinutes ?? 0, setting.roundMode ?? "none")
            : null;
          return time
            ? { label: displayLabelForPrayerType(setting.prayerType), time, details: "" }
            : null;
        }
        return resolveFixedOrRelativeRow(setting, zmanimSourceTimes, sundayZmanimSourceTimes);
      })
      .filter((item): item is { label: string; time: string; details: string } => item !== null);
  }

  const isFriday = jsDay === 5;
  const baseWeekday = weekdayForToday.length ? weekdayForToday : weekdaySettings;
  const relevantSettings = (() => {
    if (!isFriday) return baseWeekday;
    // ערב שבת: אין ערבית של חול; מנחה ערב שבת (+קבלת שבת) מחליפה מנחה של חול כשקיימת.
    const fridayWeekday = baseWeekday.filter((setting) => {
      if (setting.prayerType === "ערבית") return false;
      if (erevShabbatSettings.length && setting.prayerType === "מנחה") return false;
      return true;
    });
    return [...fridayWeekday, ...erevShabbatSettings];
  })();

  const sorted = [...relevantSettings];
  const parshaWinnerByType = parashaWinnerByType(sorted, parashaKeyForDay, jsDay);
  const minchaTime = firstMinchaClockTime(
    sorted,
    zmanimSourceTimes,
    sundayZmanimSourceTimes,
    parashaKeyForDay,
    jsDay,
    parashaCatalog
  );
  const sundayTimes = sundayZmanimSourceTimes ?? zmanimSourceTimes;
  const sundayMinchaTime =
    jsDay === 0
      ? minchaTime
      : firstMinchaClockTime(
          weekdaySettingsForDay(prayerSettings, 0),
          sundayTimes,
          sundayTimes,
          parashaKeyForDay,
          0,
          parashaCatalog
        );
  const catalogTimeByType = new Map<"מנחה" | "ערבית", string>();
  const minchaCatalog = catalogTimeForType(sorted, "מנחה", parashaKeyForDay, parashaCatalog);
  const maarivCatalog = catalogTimeForType(sorted, "ערבית", parashaKeyForDay, parashaCatalog);
  if (minchaCatalog) catalogTimeByType.set("מנחה", minchaCatalog);
  if (maarivCatalog) catalogTimeByType.set("ערבית", maarivCatalog);
  const emittedCatalog = new Set<string>();

  const out: Array<{ label: string; time: string; details: string }> = [];
  for (const setting of sorted) {
    // תפילות ערב שבת — רק fixed/relative (לא parasha)
    if (setting.category === "shabbat") {
      const row = resolveFixedOrRelativeRow(setting, zmanimSourceTimes, sundayZmanimSourceTimes);
      if (row) out.push(row);
      continue;
    }

    const winner = parshaWinnerByType.get(setting.prayerType);
    if (winner) {
      if (setting === winner && setting.mode === "parasha" && setting.fixedTime) {
        out.push({
          label: displayLabelForPrayerType(setting.prayerType),
          time: setting.fixedTime.slice(0, 5),
          details: ""
        });
      }
      continue;
    }

    const catalogTime =
      setting.prayerType === "מנחה" || setting.prayerType === "ערבית"
        ? catalogTimeByType.get(setting.prayerType) ?? null
        : null;
    if (catalogTime) {
      if (isCatalogParashaMode(setting) && !emittedCatalog.has(setting.prayerType)) {
        emittedCatalog.add(setting.prayerType);
        out.push({
          label: displayLabelForPrayerType(setting.prayerType),
          time: catalogTime,
          details: ""
        });
      }
      continue;
    }

    if (setting.mode === "parasha") continue;

    if (isMinchaAnchoredMaariv(setting)) {
      const baseMincha = usesSundayLock(setting) ? (sundayMinchaTime ?? minchaTime) : minchaTime;
      const time = baseMincha
        ? formatClockWithOffset(baseMincha, setting.offsetMinutes ?? 0, setting.roundMode ?? "none")
        : null;
      if (time) {
        out.push({
          label: displayLabelForPrayerType(setting.prayerType),
          time,
          details: ""
        });
      }
      continue;
    }

    const row = resolveFixedOrRelativeRow(setting, zmanimSourceTimes, sundayZmanimSourceTimes);
    if (row) out.push(row);
  }
  return out;
}

/** סדר תצוגת תפילות השבת — מנחה ערב שבת תחילה, ואז שחרית/מנחה/ערבית מוצ"ש. */
const SHABBAT_PRAYER_ORDER: PrayerType[] = ["מנחה ערב שבת", "שחרית שבת", "מנחה שבת", "ערבית מוצ'ש"];

/**
 * זמני תפילות לשבת הקרובה. "מנחה ערב שבת" מחושבת מזמני יום שישי; שאר התפילות מזמני שבת.
 * תומך במצב fixed ו-relative (parasha לא רלוונטי לשבת).
 */
export function buildShabbatPrayerSchedule(
  prayerSettings: PrayerSetting[],
  fridayZmanim: Record<string, string>,
  saturdayZmanim: Record<string, string>
): Array<{ label: string; time: string }> {
  const shabbatSettings = prayerSettings.filter((setting) => setting.category === "shabbat");

  const minchaShabbatTime = firstShabbatMinchaClockTime(shabbatSettings, saturdayZmanim);

  const resolved = shabbatSettings
    .map((setting, inputIndex) => {
      const zmanim = setting.prayerType === "מנחה ערב שבת" ? fridayZmanim : saturdayZmanim;
      let time: string | null = null;
      if (setting.mode === "fixed" && setting.fixedTime) {
        time = setting.fixedTime.slice(0, 5);
      } else if (isMinchaAnchoredMaariv(setting)) {
        time = minchaShabbatTime
          ? formatClockWithOffset(minchaShabbatTime, setting.offsetMinutes ?? 0, setting.roundMode ?? "none")
          : null;
      } else if (setting.mode === "relative" && setting.zmanAnchor && setting.zmanAnchor in zmanim) {
        time = formatWithOffset(zmanim[setting.zmanAnchor], setting.offsetMinutes ?? 0, setting.roundMode ?? "none");
      }
      if (!time) return null;
      const orderIndex = SHABBAT_PRAYER_ORDER.indexOf(setting.prayerType);
      return {
        label: displayLabelForPrayerType(setting.prayerType),
        time,
        order: orderIndex === -1 ? SHABBAT_PRAYER_ORDER.length : orderIndex,
        inputIndex
      };
    })
    .filter((row): row is { label: string; time: string; order: number; inputIndex: number } => row !== null);

  return resolved
    .sort((a, b) => a.order - b.order || a.inputIndex - b.inputIndex)
    .map(({ label, time }) => ({ label, time }));
}
