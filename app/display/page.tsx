import { getDisplaySnapshot, getTomorrowIsoDateFrom } from "@/lib/hebcal";
import { DisplayRotator } from "@/components/display/display-rotator";
import { getDisplayConfig, type PrayerSetting } from "@/lib/display-config";
import { getPublicHomeData } from "@/lib/data/public-content";

export const dynamic = "force-dynamic";

function formatWithOffset(baseIso: string, offsetMinutes: number) {
  const date = new Date(baseIso);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem"
  }).format(date);
}

function buildPrayerSchedule(prayerSettings: PrayerSetting[], zmanimSourceTimes: Record<string, string>) {
  const todayJsDay = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getDay();
  const isShabbat = todayJsDay === 6;
  return buildPrayerScheduleForDay(prayerSettings, zmanimSourceTimes, todayJsDay, isShabbat);
}

function buildPrayerScheduleForDay(
  prayerSettings: PrayerSetting[],
  zmanimSourceTimes: Record<string, string>,
  jsDay: number,
  isShabbat: boolean
) {

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
        return {
          label: setting.prayerType,
          time: formatWithOffset(anchorTime, offsetMinutes),
          details: ""
        };
      }

      return null;
    })
    .filter((item): item is { label: string; time: string; details: string } => item !== null);
}

function getHebrewWeekdayLabel(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "Asia/Jerusalem" }).format(date);
}

export default async function DisplayPage({
  searchParams
}: {
  searchParams: Promise<{ synagogueId?: string; minyanId?: string; forceYaaleh?: string }>;
}) {
  const params = await searchParams;
  const todayIsoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const tomorrowIsoDate = getTomorrowIsoDateFrom(todayIsoDate);

  const [snapshot, tomorrowSnapshot, publicData] = await Promise.all([
    getDisplaySnapshot(todayIsoDate),
    getDisplaySnapshot(tomorrowIsoDate),
    getPublicHomeData()
  ]);
  const displayConfig = await getDisplayConfig(params.synagogueId ?? null, params.minyanId ?? null);
  const prayerSchedule = buildPrayerSchedule(displayConfig.prayerSettings, snapshot.zmanimSourceTimes);
  const tomorrowWeekday = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
  );
  tomorrowWeekday.setDate(tomorrowWeekday.getDate() + 1);
  const tomorrowJsDay = tomorrowWeekday.getDay();
  const tomorrowPrayerSchedule = buildPrayerScheduleForDay(
    displayConfig.prayerSettings,
    tomorrowSnapshot.zmanimSourceTimes,
    tomorrowJsDay,
    tomorrowJsDay === 6
  );
  const forceYaaleh = params.forceYaaleh === "1" || params.forceYaaleh === "true";
  const displaySnapshot = forceYaaleh ? { ...snapshot, showYaalehVeyavo: true } : snapshot;
  const timeSections = [
    {
      title: `היום (${getHebrewWeekdayLabel(todayIsoDate)})`,
      items: [
        ...snapshot.zmanim.map((row) => ({ label: row.label, time: row.time, kind: "zman" as const })),
        ...prayerSchedule.map((row) => ({ label: row.label, time: row.time, details: row.details, kind: "prayer" as const }))
      ]
    },
    {
      title: `מחר (${getHebrewWeekdayLabel(tomorrowIsoDate)})`,
      items: [
        ...tomorrowSnapshot.zmanim.map((row) => ({ label: row.label, time: row.time, kind: "zman" as const })),
        ...tomorrowPrayerSchedule.map((row) => ({ label: row.label, time: row.time, details: row.details, kind: "prayer" as const }))
      ]
    }
  ];

  return (
    <DisplayRotator
      style={displayConfig.displayStyle}
      synagogueName={displayConfig.synagogueName}
      minyanName={displayConfig.minyanName}
      screens={displayConfig.screens}
      snapshot={displaySnapshot}
      halacha={{ title: publicData.halacha.title, text: publicData.halacha.text }}
      prayerSchedule={prayerSchedule}
      timeSections={timeSections}
    />
  );
}

