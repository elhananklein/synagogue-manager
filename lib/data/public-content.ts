import { getSupabaseClient } from "@/lib/supabase";
import { dailyHalacha, getTodayIsoDate, todayPrayerSchedule, type PrayerSlot } from "@/lib/data/mock-content";

type DbPrayerRow = {
  id: string;
  prayer_type: string;
  prayer_time: string;
  notes: string | null;
};

export async function getPublicHomeData() {
  const today = getTodayIsoDate();
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      schedule: todayPrayerSchedule,
      halacha: dailyHalacha
    };
  }

  const [prayerResult, halachaResult] = await Promise.all([
    supabase
      .from("prayer_schedules")
      .select("id, prayer_type, prayer_time, notes")
      .eq("schedule_date", today)
      .eq("published", true)
      .order("prayer_time", { ascending: true }),
    supabase
      .from("daily_halacha")
      .select("title, content")
      .eq("halacha_date", today)
      .eq("published", true)
      .maybeSingle()
  ]);

  const schedule: PrayerSlot[] =
    prayerResult.error || !prayerResult.data?.length
      ? todayPrayerSchedule
      : (prayerResult.data as DbPrayerRow[]).map((row, index) => ({
          id: index + 1,
          prayerName: row.prayer_type,
          time: row.prayer_time.slice(0, 5),
          notes: row.notes ?? undefined
        }));

  const halacha =
    halachaResult.error || !halachaResult.data
      ? dailyHalacha
      : {
          title: halachaResult.data.title,
          text: halachaResult.data.content
        };

  return { schedule, halacha };
}
