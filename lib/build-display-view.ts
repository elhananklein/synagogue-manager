import { getPublishedBulletinItems, type BulletinItem } from "@/lib/bulletin-board";
import { addDaysIsoDate, buildZmanimRows, getDisplaySnapshot, getTomorrowIsoDateFrom, resolveShabbatMevarchimText, type DailyLearningLine, type DisplaySnapshot } from "@/lib/hebcal";
import { getDisplayConfig, type DisplayStyle, type ScheduleTimesListMode, type ScreenSetting } from "@/lib/display-config";
import { getPublicHomeData } from "@/lib/data/public-content";
import { buildPrayerScheduleForDay, buildShabbatPrayerSchedule } from "@/lib/build-prayer-schedule";
import { getPublishedShabbatAgendaItems } from "@/lib/shabbat-agenda";

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
  /** שבת מברכין לשבת המוצגת (אם רלוונטי) */
  mevarchimText: string | null;
  /** לוח זמנים ידני של הגבאי (שעה אופציונלית + תוכן) */
  agenda: Array<{ itemTime: string | null; content: string }>;
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
  /** שבת מברכין של שבת השבוע — להצגה במסך הראשי בשישי/שבת */
  shabbatMevarchimText: string | null;
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
  bulletinItems: BulletinItem[];
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

  // נשלף קודם את הגדרות בית הכנסת כדי לקבל את המיקום, ואז נחשב את הזמנים לפיו.
  const displayConfig = await getDisplayConfig(synagogueId, minyanSelector);
  const location = displayConfig.location;

  const [snapshot, tomorrowSnapshot, publicData, bulletinItems, shabbatAgendaItems] = await Promise.all([
    getDisplaySnapshot(todayIsoDate, { location }),
    getDisplaySnapshot(tomorrowIsoDate, { omitDailyLearning: true, location }),
    getPublicHomeData(synagogueId, { todayIso: todayIsoDate }),
    getPublishedBulletinItems(synagogueId),
    getPublishedShabbatAgendaItems(displayConfig.minyanId)
  ]);

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

  const daysUntilSaturday = (6 - todayJsDay + 7) % 7;
  const saturdayIso = addDaysIsoDate(todayIsoDate, daysUntilSaturday);
  const fridayIso = addDaysIsoDate(saturdayIso, -1);

  // שבת מברכין נקבעת לפי אירועי יום השבת (לא שישי).
  let saturdayEvents: string[] = [];
  let fridaySnapshot: DisplaySnapshot | null = null;
  let saturdaySnapshot: DisplaySnapshot | null = null;

  if (shabbatScreenEnabled) {
    [fridaySnapshot, saturdaySnapshot] = await Promise.all([
      getDisplaySnapshot(fridayIso, { omitDailyLearning: true, location }),
      getDisplaySnapshot(saturdayIso, { omitDailyLearning: true, location })
    ]);
    saturdayEvents = saturdaySnapshot.sourceEvents;
  } else if (todayJsDay === 6) {
    saturdayEvents = snapshot.sourceEvents;
  } else if (todayJsDay === 5) {
    saturdayEvents = tomorrowSnapshot.sourceEvents;
  } else {
    // באמצע השבוע — אם מסך שבת כבוי עדיין נרצה לדעת לשבת הקרובה רק אם נציג בראשי בשישי/שבת;
    // אין צורך בקריאה נוספת באמצע השבוע.
    saturdayEvents = [];
  }

  const weekMevarchimText = resolveShabbatMevarchimText(saturdayEvents);
  // במסך הראשי: מציגים בשישי ובשבת של אותה שבת מברכין.
  const shabbatMevarchimText =
    weekMevarchimText && (todayJsDay === 5 || todayJsDay === 6) ? weekMevarchimText : null;

  let shabbat: DisplayShabbat | null = null;
  if (shabbatScreenEnabled && fridaySnapshot && saturdaySnapshot) {
    shabbat = {
      parasha: snapshot.parasha,
      candleLighting: snapshot.candleLighting,
      havdalah: snapshot.havdalah,
      prayers: buildShabbatPrayerSchedule(
        displayConfig.prayerSettings,
        fridaySnapshot.zmanimSourceTimes,
        saturdaySnapshot.zmanimSourceTimes
      ),
      mevarchimText: weekMevarchimText,
      agenda: shabbatAgendaItems.map((item) => ({
        itemTime: item.itemTime,
        content: item.content
      }))
    };
  }

  const includeZmanimInTimesList = displayConfig.scheduleTimesListMode !== "prayers_only";
  const todayZmanimItems = includeZmanimInTimesList
    ? buildZmanimRows(snapshot.zmanimSourceTimes, displayConfig.scheduleZmanimKeys).map((row) => ({
        label: row.label,
        time: row.time,
        kind: "zman" as const
      }))
    : [];
  const tomorrowZmanimItems = includeZmanimInTimesList
    ? buildZmanimRows(tomorrowSnapshot.zmanimSourceTimes, displayConfig.scheduleZmanimKeys).map((row) => ({
        label: row.label,
        time: row.time,
        kind: "zman" as const
      }))
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
    shabbatMevarchimText,
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
    shabbat,
    bulletinItems
  };
}
