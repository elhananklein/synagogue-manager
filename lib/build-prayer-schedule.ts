import type { PrayerSetting, PrayerType } from "@/lib/display-config";

/** ימי א׳–ה׳ בלבד — שישי ושבת לא רלוונטיים לחוק "לפי פרשה". */
export function isParashaScheduleWeekday(jsDay: number) {
  return jsDay >= 0 && jsDay <= 4;
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

/**
 * בונה רשימת זמני תפילה ליום אחד.
 * `parashaKeyForDay` — אותה מחרוזת כמו `snapshot.parasha` מאותו יום (Hebcal); null = לא להפעיל התאמת פרשה.
 */
export function buildPrayerScheduleForDay(
  prayerSettings: PrayerSetting[],
  zmanimSourceTimes: Record<string, string>,
  jsDay: number,
  isShabbat: boolean,
  parashaKeyForDay: string | null
): Array<{ label: string; time: string; details: string }> {
  const weekdaySettings = prayerSettings.filter((setting) => setting.category === "weekday");
  const shabbatSettings = prayerSettings.filter((setting) => setting.category === "shabbat");
  const weekdayForToday = weekdaySettings.filter((setting) => !setting.daysOfWeek.length || setting.daysOfWeek.includes(jsDay));

  const relevantSettings = (() => {
    if (isShabbat) {
      if (shabbatSettings.length) return shabbatSettings;
      if (weekdayForToday.length) return weekdayForToday;
      return weekdaySettings;
    }
    if (weekdayForToday.length) return weekdayForToday;
    return weekdaySettings;
  })();

  if (isShabbat) {
    return relevantSettings
      .map((setting): { label: string; time: string; details: string } | null => {
        if (setting.mode === "fixed" && setting.fixedTime) {
          return {
            label: setting.prayerType,
            time: setting.fixedTime.slice(0, 5),
            details: ""
          };
        }
        if (setting.mode === "relative" && setting.zmanAnchor && setting.zmanAnchor in zmanimSourceTimes) {
          const anchorTime = zmanimSourceTimes[setting.zmanAnchor];
          const offsetMinutes = setting.offsetMinutes ?? 0;
          const roundMode = setting.roundMode ?? "none";
          return {
            label: setting.prayerType,
            time: formatWithOffset(anchorTime, offsetMinutes, roundMode),
            details: ""
          };
        }
        return null;
      })
      .filter((item): item is { label: string; time: string; details: string } => item !== null);
  }

  const eligibleParsha =
    parashaKeyForDay &&
    parashaKeyForDay !== "לא נמצא" &&
    isParashaScheduleWeekday(jsDay);

  const sorted = [...relevantSettings];
  const parshaWinnerByType = new Map<string, PrayerSetting>();
  if (eligibleParsha) {
    for (const s of sorted) {
      if (s.mode !== "parasha" || !s.parashaKey || !s.fixedTime) continue;
      if (s.parashaKey !== parashaKeyForDay) continue;
      if (!parshaWinnerByType.has(s.prayerType)) parshaWinnerByType.set(s.prayerType, s);
    }
  }

  const out: Array<{ label: string; time: string; details: string }> = [];
  for (const setting of sorted) {
    const winner = parshaWinnerByType.get(setting.prayerType);
    if (winner) {
      if (setting === winner && setting.mode === "parasha" && setting.fixedTime) {
        out.push({
          label: setting.prayerType,
          time: setting.fixedTime.slice(0, 5),
          details: ""
        });
      }
      continue;
    }
    if (setting.mode === "parasha") continue;

    if (setting.mode === "fixed" && setting.fixedTime) {
      out.push({
        label: setting.prayerType,
        time: setting.fixedTime.slice(0, 5),
        details: ""
      });
      continue;
    }
    if (setting.mode === "relative" && setting.zmanAnchor && setting.zmanAnchor in zmanimSourceTimes) {
      const anchorTime = zmanimSourceTimes[setting.zmanAnchor];
      const offsetMinutes = setting.offsetMinutes ?? 0;
      const roundMode = setting.roundMode ?? "none";
      out.push({
        label: setting.prayerType,
        time: formatWithOffset(anchorTime, offsetMinutes, roundMode),
        details: ""
      });
    }
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

  const resolved = shabbatSettings
    .map((setting, inputIndex) => {
      const zmanim = setting.prayerType === "מנחה ערב שבת" ? fridayZmanim : saturdayZmanim;
      let time: string | null = null;
      if (setting.mode === "fixed" && setting.fixedTime) {
        time = setting.fixedTime.slice(0, 5);
      } else if (setting.mode === "relative" && setting.zmanAnchor && setting.zmanAnchor in zmanim) {
        time = formatWithOffset(zmanim[setting.zmanAnchor], setting.offsetMinutes ?? 0, setting.roundMode ?? "none");
      }
      if (!time) return null;
      const orderIndex = SHABBAT_PRAYER_ORDER.indexOf(setting.prayerType);
      return {
        label: setting.prayerType,
        time,
        order: orderIndex === -1 ? SHABBAT_PRAYER_ORDER.length : orderIndex,
        inputIndex
      };
    })
    .filter((row): row is { label: PrayerType; time: string; order: number; inputIndex: number } => row !== null);

  return resolved
    .sort((a, b) => a.order - b.order || a.inputIndex - b.inputIndex)
    .map(({ label, time }) => ({ label, time }));
}
