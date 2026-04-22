import { getSupabaseClient } from "@/lib/supabase";
import { dailyHalacha, getTodayIsoDate, todayPrayerSchedule, type PrayerSlot } from "@/lib/data/mock-content";
import { unstable_noStore as noStore } from "next/cache";

type DbPrayerRow = {
  id: string;
  prayer_type: string;
  prayer_time: string;
  minyan_label: string | null;
  notes: string | null;
};

export async function getPublicHomeData() {
  // Supabase reads should always be fresh on page refresh (avoid Route Cache).
  noStore();

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
      .select("id, prayer_type, prayer_time, minyan_label, notes")
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
          prayerName: row.minyan_label ? `${row.prayer_type} (${row.minyan_label})` : row.prayer_type,
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
