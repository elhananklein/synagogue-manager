import { cookies } from "next/headers";
import { getPublishedBulletinItems, type BulletinItem } from "@/lib/bulletin-board";
import { addDaysIsoDate, buildZmanimRows, FAST_END_LABEL, FAST_START_LABEL, fetchHebcalLeyningForDate, formatOmerShortLabel, getDisplaySnapshot, getTomorrowIsoDateFrom, resolveShabbatMevarchimText, toIsoDateJerusalem, type DailyLearningLine, type DisplaySnapshot } from "@/lib/hebcal";
import { resolveHaftarahDisplay, type HaftarahDisplay } from "@/lib/haftarah";
import { PREVIEW_LITURGICAL_TILES, previewTilesFromKeys } from "@/lib/liturgical-additions";
import { DISPLAY_STYLES, isDisplayPalette, resolveDisplayPalette } from "@/lib/display-theme";
import { isDisplayFont, resolveDisplayFont, type DisplayFont } from "@/lib/display-font";
import { getDisplayConfig, type DisplayPalette, type DisplayStyle, type ScheduleTimesListMode, type ScreenSetting } from "@/lib/display-config";
import { getPublicHomeData } from "@/lib/data/public-content";
import { buildPrayerScheduleForDay, buildShabbatPrayerSchedule, settingsNeedSundayZmanim } from "@/lib/build-prayer-schedule";
import { getPublishedShabbatAgendaItems } from "@/lib/shabbat-agenda";
import { filterDailyLearningByKeys } from "@/lib/daily-learning-catalog";
import { hebrewWeekdayLong, resolveViewIsoDate } from "@/lib/view-date";
import { isChagOnDate, isErevShabbatonDate, isOccasionScreenDay, preferredOccasionDayIndex, resolveOccasionCluster, resolveOccasionLabel } from "@/lib/sacred-occasion";

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
  /** דריסת פונט זמנית, למשל font=bonaNova */
  font?: string | string[];
  /** תאריך תצוגה YYYY-MM-DD (מובייל: דפדוף בין ימים) */
  date?: string | string[];
};

export type DisplayTimeSection = {
  title: string;
  items: Array<{ label: string; time: string; details?: string; kind: "zman" | "prayer" }>;
};

export type DisplayPrayerSlot = { label: string; time: string; details: string; prayerType?: string };

export type DisplayShabbatAgendaDay = {
  day: 1 | 2 | 3;
  iso: string;
  title: string;
  weekdayChag: boolean;
  isChag: boolean;
  isSaturday: boolean;
  isLastDay: boolean;
  items: Array<{ itemTime: string | null; content: string }>;
};

export type DisplayShabbat = {
  parasha: string;
  /** יום טוב (גם כשחל בשבת) */
  isChag: boolean;
  /** שישי/שבת של אותו מועד */
  isShabbatWeekend: boolean;
  candleLighting: string | null;
  havdalah: string | null;
  candleLabel: string;
  havdalahLabel: string;
  prayers: Array<{ label: string; time: string }>;
  /** שבת מברכין לשבת המוצגת (אם רלוונטי) */
  mevarchimText: string | null;
  /** לוח ידני שטוח (כל הימים לפי הסדר) — תאימות ולוח מלא */
  agenda: Array<{ itemTime: string | null; content: string }>;
  /** ימי שבתון עם תוכן; ערב יום 1 אינו יום נפרד */
  agendaDays: DisplayShabbatAgendaDay[];
  erevIso: string;
  preferredDay: 1 | 2 | 3;
  haftarah: HaftarahDisplay | null;
};

export type DisplayView = {
  style: DisplayStyle;
  palette: DisplayPalette;
  font: DisplayFont;
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
  /** תמיד כולל זמנים הלכתיים — למתג המובייל, בלי לשנות את הגדרת הגבאי לקיר */
  timeSectionsAll: DisplayTimeSection[];
  /** היום האזרחי לפיו נבנתה התצוגה */
  viewDate: string;
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
export async function resolveSynagogueId(params: DisplayViewParams): Promise<string | null> {
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

/** יום בשבוע (0=ראשון … 6=שבת) מתאריך אזרחי YYYY-MM-DD — בלי תלות ב־timezone של השרת. */
function jsWeekdayFromIsoDate(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function fastZmanItems(snap: DisplaySnapshot) {
  const items: Array<{ label: string; time: string; kind: "zman" }> = [];
  if (snap.fastStart) items.push({ label: FAST_START_LABEL, time: snap.fastStart, kind: "zman" });
  if (snap.fastEnd) items.push({ label: FAST_END_LABEL, time: snap.fastEnd, kind: "zman" });
  return items;
}

const ALLOWED_STYLES: DisplayStyle[] = [...DISPLAY_STYLES];

/**
 * בונה את כל הנתונים הדרושים לתצוגה (`/display` ו־`/m/display`) ממקור אחד —
 * כדי שתצוגת הקיר ותצוגת המובייל יישארו מסונכרנות לחלוטין.
 */
export async function buildDisplayView(params: DisplayViewParams): Promise<DisplayView> {
  const synagogueId = await resolveSynagogueId(params);
  const minyanSelector = singleQueryParam(params.minyan) ?? singleQueryParam(params.minyanId);

  const jerusalemTodayIso = toIsoDateJerusalem();
  const todayIsoDate = resolveViewIsoDate(singleQueryParam(params.date), jerusalemTodayIso);
  const tomorrowIsoDate = getTomorrowIsoDateFrom(todayIsoDate);

  // נשלף קודם את הגדרות בית הכנסת כדי לקבל את המיקום, ואז נחשב את הזמנים לפיו.
  const displayConfig = await getDisplayConfig(synagogueId, minyanSelector);
  const location = displayConfig.location;
  const snapshotOptions = { location, haftarahMinhag: displayConfig.haftarahMinhag };

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
      : Promise.all(extraSundayIsos.map((iso) => getDisplaySnapshot(iso, { omitDailyLearning: true, ...snapshotOptions })));

  const [[snapshot, tomorrowSnapshot, publicData, bulletinItems, shabbatAgendaItems], sundaySnaps] = await Promise.all([
    Promise.all([
      getDisplaySnapshot(todayIsoDate, snapshotOptions),
      getDisplaySnapshot(tomorrowIsoDate, { omitDailyLearning: true, ...snapshotOptions }),
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
  const fontOverrideRaw = singleQueryParam(params.font);
  const effectiveFont = isDisplayFont(fontOverrideRaw)
    ? fontOverrideRaw
    : resolveDisplayFont(displayConfig.displayFont);

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
    displayConfig.parashaCatalog,
    {
      treatAsErev: isErevShabbatonDate(todayIsoDate),
      isChag: isChagOnDate(tomorrowIsoDate)
    }
  );
  const tomorrowPrayerSchedule = buildPrayerScheduleForDay(
    displayConfig.prayerSettings,
    tomorrowSnapshot.zmanimSourceTimes,
    tomorrowJsDay,
    tomorrowJsDay === 6,
    tomorrowSnapshot.parashaCatalogKey,
    zmanimByIso(tomorrowSundayIso),
    displayConfig.parashaCatalog,
    {
      treatAsErev: isErevShabbatonDate(tomorrowIsoDate),
      isChag: isChagOnDate(addDaysIsoDate(tomorrowIsoDate, 1))
    }
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
  const cluster = resolveOccasionCluster(todayIsoDate);
  const todayIsWeekdayChag = isChagOnDate(todayIsoDate) && todayJsDay !== 5 && todayJsDay !== 6;
  const titleIso =
    cluster.days.find((day) => isChagOnDate(day.iso))?.iso ??
    cluster.days.find((day) => day.isSaturday)?.iso ??
    saturdayIso;
  const occasionIso = todayIsWeekdayChag ? todayIsoDate : titleIso;
  const occasionScreenActive = isOccasionScreenDay(todayIsoDate);
  const leyningIso = cluster.days.find((day) => day.isSaturday)?.iso ?? occasionIso;
  const leyningItem = await fetchHebcalLeyningForDate(leyningIso);
  const haftarah = resolveHaftarahDisplay(leyningItem, displayConfig.haftarahMinhag);
  displaySnapshot.haftarah = haftarah;

  // שבת מברכין נקבעת לפי אירועי יום השבת (לא שישי).
  let saturdayEvents: string[] = [];
  let fridaySnapshot: DisplaySnapshot | null = null;
  let saturdaySnapshot: DisplaySnapshot | null = null;
  let erevSnapshot: DisplaySnapshot | null = null;
  let lastDaySnapshot: DisplaySnapshot | null = null;

  const lastClusterIso = cluster.days[cluster.days.length - 1]?.iso ?? saturdayIso;

  if (shabbatScreenEnabled) {
    const extraIsos = [cluster.erevIso, lastClusterIso].filter(
      (iso) => iso !== fridayIso && iso !== saturdayIso && iso !== todayIsoDate && iso !== tomorrowIsoDate
    );
    const uniqueExtra = [...new Set(extraIsos)];
    const [friSnap, satSnap, extraSnaps] = await Promise.all([
      getDisplaySnapshot(fridayIso, { omitDailyLearning: true, ...snapshotOptions }),
      getDisplaySnapshot(saturdayIso, { omitDailyLearning: true, ...snapshotOptions }),
      Promise.all(uniqueExtra.map((iso) => getDisplaySnapshot(iso, { omitDailyLearning: true, ...snapshotOptions })))
    ]);
    fridaySnapshot = friSnap;
    saturdaySnapshot = satSnap;
    saturdayEvents = saturdaySnapshot.sourceEvents;
    const extraByIso = new Map(uniqueExtra.map((iso, index) => [iso, extraSnaps[index] ?? null]));
    const snapFor = (iso: string): DisplaySnapshot | null => {
      if (iso === todayIsoDate) return snapshot;
      if (iso === tomorrowIsoDate) return tomorrowSnapshot;
      if (iso === fridayIso) return fridaySnapshot;
      if (iso === saturdayIso) return saturdaySnapshot;
      return extraByIso.get(iso) ?? null;
    };
    erevSnapshot = snapFor(cluster.erevIso);
    lastDaySnapshot = snapFor(lastClusterIso);
  } else if (todayJsDay === 6) {
    saturdayEvents = snapshot.sourceEvents;
  } else if (todayJsDay === 5) {
    saturdayEvents = tomorrowSnapshot.sourceEvents;
  } else {
    saturdayEvents = [];
  }

  const weekMevarchimText = resolveShabbatMevarchimText(saturdayEvents);
  const shabbatMevarchimText =
    weekMevarchimText && (todayJsDay === 5 || todayJsDay === 6) ? weekMevarchimText : null;

  let shabbat: DisplayShabbat | null = null;
  if (shabbatScreenEnabled && occasionScreenActive) {
    const occasionLabel =
      resolveOccasionLabel(occasionIso) ||
      (todayIsWeekdayChag ? displaySnapshot.parasha : saturdaySnapshot?.parasha) ||
      displaySnapshot.parasha;
    const isChag = cluster.days.some((day) => isChagOnDate(day.iso)) || isChagOnDate(occasionIso);
    const isShabbatWeekend = todayJsDay === 5 || todayJsDay === 6 || cluster.days.some((day) => day.isSaturday);
    const firstDayIsChag = cluster.days[0] ? isChagOnDate(cluster.days[0].iso) : isChag;
    const lastDayIsSaturday = Boolean(cluster.days[cluster.days.length - 1]?.isSaturday);
    const publishedAgenda = shabbatAgendaItems.filter((item) => item.content.trim());
    const maxFilled = Math.max(0, ...publishedAgenda.map((item) => item.occasionDay));
    const maxDay = Math.min(3, Math.max(cluster.days.length, maxFilled));
    const agendaDays: DisplayShabbatAgendaDay[] = [];
    for (let day = 1; day <= maxDay; day += 1) {
      const meta = cluster.days[day - 1];
      const dayItems = publishedAgenda.filter((item) => item.occasionDay === day);
      if (!dayItems.length) continue;
      agendaDays.push({
        day: day as 1 | 2 | 3,
        iso: meta?.iso ?? "",
        title: meta?.title ?? "",
        weekdayChag: meta?.weekdayChag ?? false,
        isChag: meta?.isChag ?? false,
        isSaturday: meta?.isSaturday ?? false,
        isLastDay: meta ? meta.isLastDay : day === maxFilled,
        items: dayItems.map((item) => ({ itemTime: item.itemTime, content: item.content }))
      });
    }
    shabbat = {
      parasha: occasionLabel,
      isChag,
      isShabbatWeekend,
      candleLighting: (erevSnapshot ?? fridaySnapshot ?? displaySnapshot).candleLighting,
      havdalah: (lastDaySnapshot ?? saturdaySnapshot ?? displaySnapshot).havdalah,
      candleLabel: firstDayIsChag ? "כניסת החג" : "כניסת שבת",
      havdalahLabel: lastDayIsSaturday ? "צאת שבת" : "צאת החג",
      prayers: todayIsWeekdayChag
        ? prayerSchedule.map((row) => ({ label: row.label, time: row.time }))
        : fridaySnapshot && saturdaySnapshot
          ? buildShabbatPrayerSchedule(
              displayConfig.prayerSettings,
              fridaySnapshot.zmanimSourceTimes,
              saturdaySnapshot.zmanimSourceTimes,
              firstDayIsChag
            )
          : [],
      mevarchimText: weekMevarchimText,
      agenda: publishedAgenda.map((item) => ({
        itemTime: item.itemTime,
        content: item.content
      })),
      agendaDays,
      erevIso: cluster.erevIso,
      preferredDay: preferredOccasionDayIndex(todayIsoDate, cluster),
      haftarah
    };
  }

  const todayZmanimItems = [
    ...fastZmanItems(snapshot),
    ...buildZmanimRows(snapshot.zmanimSourceTimes, displayConfig.scheduleZmanimKeys).map((row) => ({
      label: row.label,
      time: row.time,
      kind: "zman" as const
    }))
  ];
  const tomorrowZmanimItems = [
    ...fastZmanItems(tomorrowSnapshot),
    ...buildZmanimRows(tomorrowSnapshot.zmanimSourceTimes, displayConfig.scheduleZmanimKeys).map((row) => ({
      label: row.label,
      time: row.time,
      kind: "zman" as const
    }))
  ];
  const todayPrayerItems = prayerSchedule.map((row) => ({
    label: row.label,
    time: row.time,
    details: row.details,
    kind: "prayer" as const
  }));
  const tomorrowPrayerItems = tomorrowPrayerSchedule.map((row) => ({
    label: row.label,
    time: row.time,
    details: row.details,
    kind: "prayer" as const
  }));
  const includeZmanimInTimesList = displayConfig.scheduleTimesListMode !== "prayers_only";
  const timeSectionsAll: DisplayTimeSection[] = [
    {
      title: `היום (${hebrewWeekdayLong(todayIsoDate)})`,
      items: [...todayZmanimItems, ...todayPrayerItems]
    },
    {
      title: `מחר (${hebrewWeekdayLong(tomorrowIsoDate)})`,
      items: [...tomorrowZmanimItems, ...tomorrowPrayerItems]
    }
  ];
  const timeSections: DisplayTimeSection[] = includeZmanimInTimesList
    ? timeSectionsAll
    : [
        { title: timeSectionsAll[0].title, items: [...fastZmanItems(snapshot), ...todayPrayerItems] },
        { title: timeSectionsAll[1].title, items: [...fastZmanItems(tomorrowSnapshot), ...tomorrowPrayerItems] }
      ];

  return {
    style: effectiveStyle,
    palette: effectivePalette,
    font: effectiveFont,
    synagogueId,
    synagogueName: displayConfig.synagogueName,
    minyanName: displayConfig.minyanName,
    footerText: displayConfig.footerText,
    scheduleTimesListMode: displayConfig.scheduleTimesListMode,
    screens: displayConfig.screens,
    dailyLearning: filterDailyLearningByKeys(snapshot.dailyLearning, displayConfig.dailyLearningKeys),
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
    timeSectionsAll,
    viewDate: todayIsoDate,
    shabbat,
    bulletinItems
  };
}
