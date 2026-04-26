import { getDisplaySnapshot } from "@/lib/hebcal";
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
  const zmanLabelMap: Record<string, string> = {
    sunrise: "זריחה",
    sunset: "שקיעה",
    chatzot: "חצות",
    tzeit85deg: "צאת הכוכבים"
  };

  const weekdaySettings = prayerSettings.filter((setting) => setting.category === "weekday");
  const shabbatSettings = prayerSettings.filter((setting) => setting.category === "shabbat");
  const weekdayForToday = weekdaySettings.filter((setting) => !setting.daysOfWeek.length || setting.daysOfWeek.includes(todayJsDay));

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
          details: setting.category === "shabbat" ? "תפילת שבת - זמן קבוע" : "זמן קבוע"
        };
      }

      if (setting.mode === "relative" && setting.zmanAnchor && setting.zmanAnchor in zmanimSourceTimes) {
        const anchorTime = zmanimSourceTimes[setting.zmanAnchor];
        const offsetMinutes = setting.offsetMinutes ?? 0;
        const sign = offsetMinutes >= 0 ? "+" : "";
        const anchorLabel = zmanLabelMap[setting.zmanAnchor] ?? setting.zmanAnchor;
        return {
          label: setting.prayerType,
          time: formatWithOffset(anchorTime, offsetMinutes),
          details: `יחסית ל-${anchorLabel} (${sign}${offsetMinutes} דק')`
        };
      }

      return null;
    })
    .filter((item): item is { label: string; time: string; details: string } => item !== null);
}

export default async function DisplayPage({
  searchParams
}: {
  searchParams: Promise<{ synagogueId?: string; minyanId?: string }>;
}) {
  const params = await searchParams;
  const [snapshot, publicData] = await Promise.all([getDisplaySnapshot(), getPublicHomeData()]);
  const displayConfig = await getDisplayConfig(params.synagogueId ?? null, params.minyanId ?? null);
  const prayerSchedule = buildPrayerSchedule(displayConfig.prayerSettings, snapshot.zmanimSourceTimes);

  return (
    <DisplayRotator
      style={displayConfig.displayStyle}
      synagogueName={displayConfig.synagogueName}
      minyanName={displayConfig.minyanName}
      screens={displayConfig.screens}
      snapshot={snapshot}
      halacha={{ title: publicData.halacha.title, text: publicData.halacha.text }}
      prayerSchedule={prayerSchedule}
    />
  );
}

