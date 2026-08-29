import { cookies } from "next/headers";
import { getPublishedBulletinItems, type BulletinItem } from "@/lib/bulletin-board";
import { addDaysIsoDate, buildZmanimRows, fetchHebcalLeyningForDate, formatOmerShortLabel, getDisplaySnapshot, getTomorrowIsoDateFrom, resolveShabbatMevarchimText, type DailyLearningLine, type DisplaySnapshot } from "@/lib/hebcal";
import { resolveHaftarahDisplay, type HaftarahDisplay } from "@/lib/haftarah";
import { PREVIEW_LITURGICAL_TILES, previewTilesFromKeys } from "@/lib/liturgical-additions";
import { DISPLAY_STYLES, isDisplayPalette, resolveDisplayPalette } from "@/lib/display-theme";
import { getDisplayConfig, type DisplayPalette, type DisplayStyle, type ScheduleTimesListMode, type ScreenSetting } from "@/lib/display-config";
import { getPublicHomeData } from "@/lib/data/public-content";
import { buildPrayerScheduleForDay, buildShabbatPrayerSchedule, settingsNeedSundayZmanim } from "@/lib/build-prayer-schedule";
import { getPublishedShabbatAgendaItems } from "@/lib/shabbat-agenda";

export type DisplayViewParams = {
  synagogueId?: string | string[];
  /** מספר סידורי (1,2,…), שם מניין, או UUID — עדיף ל־`minyan` */
  minyan?: string | string[];
  minyanId?: string | string[];
  forceYaaleh?: string | string[];
  forceOmer?: string | string[];
  forceAdditions?: string | string[];
  /** תצוגה מקדימה של אריח בודד, למשל forceTile=aneinu */
  forceTile?: string | string[];
  /** דריסת סגנון זמנית לתצוגה מקדימה, למשל style=royalBlue (לא משנה את ה-DB) */
  style?: string | string[];
  /** דריסת פלטה זמנית, למשל palette=inkIvory */
  palette?: string | string[];
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
  haftarah: HaftarahDisplay | null;
};

export type DisplayView = {
  style: DisplayStyle;
  palette: DisplayPalette;
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
    segments?: string[];
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

/** synagogueId מה־URL, אחרת מה־cookie / ברירת מחדל — בלי זה אין תפילות בלוח. */
async function resolveSynagogueId(params: DisplayViewParams): Promise<string | null> {
  const fromQuery = singleQueryParam(params.synagogueId);
  if (fromQuery) return fromQuery;
  try {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get("synagogue_id")?.value?.trim();
    if (fromCookie) return fromCookie;
  } catch {
    /* cookies() לא זמין מחוץ ל־request */
  }
  const fromEnv = process.env.NEXT_PUBLIC_DEFAULT_SYNAGOGUE_ID?.trim();
  return fromEnv || null;
}

function getHebrewWeekdayLabel(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (date.getUTCDay() === 6) return "שבת";
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "UTC" }).format(date);
}

/** יום בשבוע (0=ראשון … 6=שבת) מתאריך אזרחי YYYY-MM-DD — בלי תלות ב־timezone של השרת. */
function jsWeekdayFromIsoDate(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

const ALLOWED_STYLES: DisplayStyle[] = [...DISPLAY_STYLES];

/**
 * בונה את כל הנתונים הדרושים לתצוגה (`/display` ו־`/m/display`) ממקור אחד —
 * כדי שתצוגת הקיר ותצוגת המובייל יישארו מסונכרנות לחלוטין.
 */
export async function buildDisplayView(params: DisplayViewParams): Promise<DisplayView> {
  const synagogueId = await resolveSynagogueId(params);
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

  const todaySundayIso = addDaysIsoDate(todayIsoDate, -jsWeekdayFromIsoDate(todayIsoDate));
  const tomorrowSundayIso = addDaysIsoDate(tomorrowIsoDate, -jsWeekdayFromIsoDate(tomorrowIsoDate));
  const extraSundayIsos: string[] = [];
  if (settingsNeedSundayZmanim(displayConfig.prayerSettings)) {
    for (const iso of [todaySundayIso, tomorrowSundayIso]) {
      if (iso !== todayIsoDate && iso !== tomorrowIsoDate && !extraSundayIsos.includes(iso)) {
        extraSundayIsos.push(iso);
      }
    }
  }

  const extraSundayPromise =
    extraSundayIsos.length === 0
      ? Promise.resolve([] as DisplaySnapshot[])
      : Promise.all(extraSundayIsos.map((iso) => getDisplaySnapshot(iso, { omitDailyLearning: true, location })));

  const [[snapshot, tomorrowSnapshot, publicData, bulletinItems, shabbatAgendaItems], sundaySnaps] = await Promise.all([
    Promise.all([
      getDisplaySnapshot(todayIsoDate, { location }),
      getDisplaySnapshot(tomorrowIsoDate, { omitDailyLearning: true, location }),
      getPublicHomeData(synagogueId, { todayIso: todayIsoDate }),
      getPublishedBulletinItems(synagogueId),
      getPublishedShabbatAgendaItems(displayConfig.minyanId)
    ]),
    extraSundayPromise
  ]);

  const styleOverrideRaw = singleQueryParam(params.style);
  const styleOverride = ALLOWED_STYLES.find((s) => s === styleOverrideRaw) ?? null;
  const effectiveStyle = styleOverride ?? displayConfig.displayStyle;
  const paletteOverrideRaw = singleQueryParam(params.palette);
  const effectivePalette = resolveDisplayPalette(
    effectiveStyle,
    isDisplayPalette(paletteOverrideRaw) ? paletteOverrideRaw : displayConfig.displayPalette
  );

  const todayJsDay = jsWeekdayFromIsoDate(todayIsoDate);
  const tomorrowJsDay = jsWeekdayFromIsoDate(tomorrowIsoDate);
  const isShabbatToday = todayJsDay === 6;

  const zmanimByIso = (iso: string): Record<string, string> => {
    if (iso === todayIsoDate) return snapshot.zmanimSourceTimes;
    if (iso === tomorrowIsoDate) return tomorrowSnapshot.zmanimSourceTimes;
    const extraIndex = extraSundayIsos.indexOf(iso);
    if (extraIndex >= 0) return sundaySnaps[extraIndex]?.zmanimSourceTimes ?? snapshot.zmanimSourceTimes;
    return snapshot.zmanimSourceTimes;
  };

  const prayerSchedule = buildPrayerScheduleForDay(
    displayConfig.prayerSettings,
    snapshot.zmanimSourceTimes,
    todayJsDay,
    isShabbatToday,
    snapshot.parashaCatalogKey,
    zmanimByIso(todaySundayIso),
    displayConfig.parashaCatalog
  );
  const tomorrowPrayerSchedule = buildPrayerScheduleForDay(
    displayConfig.prayerSettings,
    tomorrowSnapshot.zmanimSourceTimes,
    tomorrowJsDay,
    tomorrowJsDay === 6,
    tomorrowSnapshot.parashaCatalogKey,
    zmanimByIso(tomorrowSundayIso),
    displayConfig.parashaCatalog
  );

  const forceYaalehRaw = singleQueryParam(params.forceYaaleh);
  const forceYaaleh = forceYaalehRaw === "1" || forceYaalehRaw === "true";
  const forceOmerRaw = singleQueryParam(params.forceOmer);
  const forceOmer = forceOmerRaw === "1" || forceOmerRaw === "true";
  const forceAdditionsRaw = singleQueryParam(params.forceAdditions);
  const forceAdditions = forceAdditionsRaw === "1" || forceAdditionsRaw === "true";
  const forceTileRaw = Array.isArray(params.forceTile)
    ? params.forceTile
    : params.forceTile
      ? [params.forceTile]
      : [];
  const forceTileKeys = forceTileRaw.flatMap((value) => String(value).split(/[,+|]/));
  const forcedTiles = previewTilesFromKeys(forceTileKeys);
  const displaySnapshot =
    forceYaaleh || forceOmer || forceAdditions || forcedTiles.length
      ? {
          ...snapshot,
          ...(forceYaaleh ? { amidahAdditionText: "יעלה ויבוא" as const } : {}),
          ...(forceOmer
            ? {
                omerText: "היום שלושה עשר יום שהם שבוע אחד ושישה ימים בעומר",
                omerShortText: formatOmerShortLabel(13)
              }
            : {}),
          ...(forceAdditions
            ? { liturgicalTiles: PREVIEW_LITURGICAL_TILES }
            : forcedTiles.length
              ? { liturgicalTiles: forcedTiles }
              : {})
        }
      : snapshot;

  const shabbatScreenEnabled = displayConfig.screens.some(
    (screen) => screen.screenKey === "shabbat" && screen.enabled
  );

  const daysUntilSaturday = (6 - todayJsDay + 7) % 7;
  const saturdayIso = addDaysIsoDate(todayIsoDate, daysUntilSaturday);
  const fridayIso = addDaysIsoDate(saturdayIso, -1);
  const leyningItem = await fetchHebcalLeyningForDate(saturdayIso);
  const haftarah = resolveHaftarahDisplay(leyningItem, displayConfig.haftarahMinhag);
  displaySnapshot.haftarah = haftarah;

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
      })),
      haftarah
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
    palette: effectivePalette,
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
          sectionNumber: publicData.halacha.sectionNumber,
          segments: publicData.halacha.segments
        }
      : null,
    prayerSchedule,
    timeSections,
    shabbat,
    bulletinItems
  };
}
