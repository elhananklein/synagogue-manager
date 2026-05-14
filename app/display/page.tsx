import { getDisplaySnapshot, getTomorrowIsoDateFrom } from "@/lib/hebcal";
import { DisplayRotator } from "@/components/display/display-rotator";
import { getDisplayConfig } from "@/lib/display-config";
import { getPublicHomeData } from "@/lib/data/public-content";
import { buildPrayerScheduleForDay } from "@/lib/build-prayer-schedule";

export const dynamic = "force-dynamic";

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

export default async function DisplayPage({
  searchParams
}: {
  searchParams: Promise<{
    synagogueId?: string | string[];
    /** מספר סידורי (1,2,…), שם מניין, או UUID — עדיף ל־`minyan` */
    minyan?: string | string[];
    minyanId?: string | string[];
    forceYaaleh?: string | string[];
  }>;
}) {
  const params = await searchParams;
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
  const displaySnapshot = forceYaaleh ? { ...snapshot, showYaalehVeyavo: true } : snapshot;
  const includeZmanimInTimesList = displayConfig.scheduleTimesListMode !== "prayers_only";
  const todayZmanimItems = includeZmanimInTimesList
    ? snapshot.zmanim.map((row) => ({ label: row.label, time: row.time, kind: "zman" as const }))
    : [];
  const tomorrowZmanimItems = includeZmanimInTimesList
    ? tomorrowSnapshot.zmanim.map((row) => ({ label: row.label, time: row.time, kind: "zman" as const }))
    : [];
  const timeSections = [
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

  return (
    <DisplayRotator
      style={displayConfig.displayStyle}
      synagogueId={synagogueId}
      synagogueName={displayConfig.synagogueName}
      minyanName={displayConfig.minyanName}
      screens={displayConfig.screens}
      dailyLearning={snapshot.dailyLearning}
      snapshot={displaySnapshot}
      halacha={
        publicData.halacha
          ? {
              title: publicData.halacha.title,
              text: publicData.halacha.text,
              source: publicData.halacha.source,
              chapterNumber: publicData.halacha.chapterNumber,
              sectionNumber: publicData.halacha.sectionNumber
            }
          : null
      }
      prayerSchedule={prayerSchedule}
      timeSections={timeSections}
    />
  );
}
