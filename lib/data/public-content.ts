import { getSupabaseClient } from "@/lib/supabase";
import { getTodayIsoDate, todayPrayerSchedule, type PrayerSlot } from "@/lib/data/mock-content";
import { unstable_noStore as noStore } from "next/cache";

type DbPrayerRow = {
  id: string;
  schedule_date?: string;
  prayer_type: string;
  prayer_time: string;
  minyan_label: string | null;
  notes: string | null;
};

function getIsoDateUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function diffDays(aIso: string, bIso: string) {
  const a = new Date(`${aIso}T00:00:00.000Z`).getTime();
  const b = new Date(`${bIso}T00:00:00.000Z`).getTime();
  return Math.floor((a - b) / (24 * 60 * 60 * 1000));
}

export async function getPublicHomeData(synagogueId?: string | null) {
  // Supabase reads should always be fresh on page refresh (avoid Route Cache).
  noStore();

  const todayJerusalem = getTodayIsoDate();
  const now = new Date();
  const todayUtc = getIsoDateUtc(now);
  const yesterdayUtc = getIsoDateUtc(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const candidateDates = Array.from(new Set([todayJerusalem, todayUtc, yesterdayUtc]));
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      schedule: todayPrayerSchedule,
      halacha: {
        title: "הלכה יומית",
        text: "אין חיבור למסד נתונים ולכן לא ניתן להציג הלכה ממקור מוגדר.",
        source: "אין מקור זמין"
      }
    };
  }

  const [prayerResult, halachaSettingsRes] = await Promise.all([
    supabase
      .from("prayer_schedules")
      .select("id, schedule_date, prayer_type, prayer_time, minyan_label, notes")
      .in("schedule_date", candidateDates)
      .eq("published", true)
      .order("schedule_date", { ascending: false })
      .order("prayer_time", { ascending: true }),
    supabase
      .from("synagogue_halacha_settings")
      .select("start_date, source_key, display_mode")
      .eq("synagogue_id", synagogueId ?? "")
      .maybeSingle()
  ]);
  const selectedSourceKey = halachaSettingsRes.data?.source_key ?? "kitzur_shulchan_arukh";
  const halachaResult = await supabase
    .from("daily_halacha")
    .select("title, content, full_text, summary_text, display_day, source_key, chapter_number, section_number")
    .eq("source_key", selectedSourceKey)
    .eq("published", true)
    .order("display_day", { ascending: true });

  const schedule: PrayerSlot[] =
    prayerResult.error || !prayerResult.data?.length
      ? todayPrayerSchedule
      : (prayerResult.data as DbPrayerRow[]).map((row, index) => ({
          id: index + 1,
          prayerName: row.minyan_label ? `${row.prayer_type} (${row.minyan_label})` : row.prayer_type,
          time: row.prayer_time.slice(0, 5),
          notes: row.notes ?? undefined
        }));

  const dbHalacha = await (async () => {
    if (halachaResult.error || !halachaResult.data?.length) return null;
    const startDate = halachaSettingsRes.data?.start_date ?? todayJerusalem;
    const displayMode = halachaSettingsRes.data?.display_mode ?? "summary";
    const daysFromStart = Math.max(0, diffDays(todayJerusalem, startDate));
    const targetDisplayDay = daysFromStart + 1;
    const chosen =
      halachaResult.data.find((row) => Number(row.display_day) === targetDisplayDay) ??
      halachaResult.data[halachaResult.data.length - 1];
    if (!chosen) return null;
    const text =
      displayMode === "full"
        ? (chosen.full_text?.trim() || "אין טקסט מלא זמין להלכה זו.")
        : (chosen.summary_text ?? chosen.content);
    return {
      title: chosen.title,
      text,
      source: selectedSourceKey === "kitzur_shulchan_arukh" ? "קיצור שולחן ערוך" : "מקור פנימי"
    };
  })();

  const halacha = dbHalacha ?? {
    title: "הלכה יומית",
    text: "לא נמצאה הלכה זמינה למקור וליום שהוגדרו. יש למשוך הלכות למקור הנבחר.",
    source: "אין הלכה זמינה"
  };

  return { schedule, halacha };
}
