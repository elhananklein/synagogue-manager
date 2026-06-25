import { addDaysIsoDate, getDisplaySnapshot, getTomorrowIsoDateFrom, type DailyLearningLine, type DisplaySnapshot } from "@/lib/hebcal";
import { getDisplayConfig, type DisplayStyle, type ScheduleTimesListMode, type ScreenSetting } from "@/lib/display-config";
import { getPublicHomeData } from "@/lib/data/public-content";
import { buildPrayerScheduleForDay, buildShabbatPrayerSchedule } from "@/lib/build-prayer-schedule";

export type DisplayViewParams = {
  synagogueId?: string | string[];
  /** מספר סידורי (1,2,…), שם מניין, או UUID — עדיף ל־`minyan` */
  minyan?: string | string[];
  minyanId?: string | string[];
  forceYaaleh?: string | string[];
  /** דריסת סגנון זמנית לתצוגה מקדימה, למשל style=royalBlue (לא משנה את ה-DB) */
  style?: string | string[];
};

export type DisplayTimeSection = {
  title: string;
  items: Array<{ label: string; time: string; details?: string; kind: "zman" | "prayer" }>;
};

export type DisplayPrayerSlot = { label: string; time: string; details: string };

export type DisplayShabbat = {
  parasha: string;
  candleLighting: string | null;
  havdalah: string | null;
  prayers: Array<{ label: string; time: string }>;
};

export type DisplayView = {
  style: DisplayStyle;
  synagogueId: string | null;
  synagogueName: string;
  minyanName: string | null;
  footerText: string | null;
  scheduleTimesListMode: ScheduleTimesListMode;
  screens: ScreenSetting[];
  dailyLearning: DailyLearningLine[];
  snapshot: DisplaySnapshot;
  halacha: {
    title: string;
    text: string;
    source?: string;
    chapterNumber?: number;
    sectionNumber?: number;
  } | null;
  prayerSchedule: DisplayPrayerSlot[];
  timeSections: DisplayTimeSection[];
  shabbat: DisplayShabbat | null;
};

function singleQueryParam(value: string | string[] | undefined | null): string | null {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const s = String(raw ?? "").trim();
  return s.length ? s : null;
}

function getHebrewWeekdayLabel(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "Asia/Jerusalem" }).format(date);
}

const ALLOWED_STYLES: DisplayStyle[] = ["classic", "modern", "minimal", "woodSilver", "royalBlue"];

/**
 * בונה את כל הנתונים הדרושים לתצוגה (`/display` ו־`/m/display`) ממקור אחד —
 * כדי שתצוגת הקיר ותצוגת המובייל יישארו מסונכרנות לחלוטין.
 */
export async function buildDisplayView(params: DisplayViewParams): Promise<DisplayView> {
  const synagogueId = singleQueryParam(params.synagogueId);
  const minyanSelector = singleQueryParam(params.minyan) ?? singleQueryParam(params.minyanId);

  const todayIsoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const tomorrowIsoDate = getTomorrowIsoDateFrom(todayIsoDate);

  const [snapshot, tomorrowSnapshot, publicData] = await Promise.all([
    getDisplaySnapshot(todayIsoDate),
    getDisplaySnapshot(tomorrowIsoDate, { omitDailyLearning: true }),
    getPublicHomeData(synagogueId, { todayIso: todayIsoDate })
  ]);
  const displayConfig = await getDisplayConfig(synagogueId, minyanSelector);

  const styleOverrideRaw = singleQueryParam(params.style);
  const styleOverride = ALLOWED_STYLES.find((s) => s === styleOverrideRaw) ?? null;
  const effectiveStyle = styleOverride ?? displayConfig.displayStyle;

  const todayJsDay = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getDay();
  const isShabbatToday = todayJsDay === 6;
  const prayerSchedule = buildPrayerScheduleForDay(
    displayConfig.prayerSettings,
    snapshot.zmanimSourceTimes,
    todayJsDay,
    isShabbatToday,
    snapshot.parasha
  );
  const tomorrowWeekday = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  tomorrowWeekday.setDate(tomorrowWeekday.getDate() + 1);
  const tomorrowJsDay = tomorrowWeekday.getDay();
  const tomorrowPrayerSchedule = buildPrayerScheduleForDay(
    displayConfig.prayerSettings,
    tomorrowSnapshot.zmanimSourceTimes,
    tomorrowJsDay,
    tomorrowJsDay === 6,
    tomorrowSnapshot.parasha
  );

  const forceYaalehRaw = singleQueryParam(params.forceYaaleh);
  const forceYaaleh = forceYaalehRaw === "1" || forceYaalehRaw === "true";
  const displaySnapshot = forceYaaleh
    ? { ...snapshot, amidahAdditionText: "יעלה ויבוא" as const }
    : snapshot;

  const shabbatScreenEnabled = displayConfig.screens.some(
    (screen) => screen.screenKey === "shabbat" && screen.enabled
  );
  let shabbat: DisplayShabbat | null = null;
  if (shabbatScreenEnabled) {
    const daysUntilSaturday = (6 - todayJsDay + 7) % 7;
    const saturdayIso = addDaysIsoDate(todayIsoDate, daysUntilSaturday);
    const fridayIso = addDaysIsoDate(saturdayIso, -1);
    const [fridaySnapshot, saturdaySnapshot] = await Promise.all([
      getDisplaySnapshot(fridayIso, { omitDailyLearning: true }),
      getDisplaySnapshot(saturdayIso, { omitDailyLearning: true })
    ]);
    shabbat = {
      parasha: snapshot.parasha,
      candleLighting: snapshot.candleLighting,
      havdalah: snapshot.havdalah,
      prayers: buildShabbatPrayerSchedule(
        displayConfig.prayerSettings,
        fridaySnapshot.zmanimSourceTimes,
        saturdaySnapshot.zmanimSourceTimes
      )
    };
  }

  const includeZmanimInTimesList = displayConfig.scheduleTimesListMode !== "prayers_only";
  const todayZmanimItems = includeZmanimInTimesList
    ? snapshot.zmanim.map((row) => ({ label: row.label, time: row.time, kind: "zman" as const }))
    : [];
  const tomorrowZmanimItems = includeZmanimInTimesList
    ? tomorrowSnapshot.zmanim.map((row) => ({ label: row.label, time: row.time, kind: "zman" as const }))
    : [];
  const timeSections: DisplayTimeSection[] = [
    {
      title: `היום (${getHebrewWeekdayLabel(todayIsoDate)})`,
      items: [
        ...todayZmanimItems,
        ...prayerSchedule.map((row) => ({ label: row.label, time: row.time, details: row.details, kind: "prayer" as const }))
      ]
    },
    {
      title: `מחר (${getHebrewWeekdayLabel(tomorrowIsoDate)})`,
      items: [
        ...tomorrowZmanimItems,
        ...tomorrowPrayerSchedule.map((row) => ({ label: row.label, time: row.time, details: row.details, kind: "prayer" as const }))
      ]
    }
  ];

  return {
    style: effectiveStyle,
    synagogueId,
    synagogueName: displayConfig.synagogueName,
    minyanName: displayConfig.minyanName,
    footerText: displayConfig.footerText,
    scheduleTimesListMode: displayConfig.scheduleTimesListMode,
    screens: displayConfig.screens,
    dailyLearning: snapshot.dailyLearning,
    snapshot: displaySnapshot,
    halacha: publicData.halacha
      ? {
          title: publicData.halacha.title,
          text: publicData.halacha.text,
          source: publicData.halacha.source,
          chapterNumber: publicData.halacha.chapterNumber,
          sectionNumber: publicData.halacha.sectionNumber
        }
      : null,
    prayerSchedule,
    timeSections,
    shabbat
  };
}
