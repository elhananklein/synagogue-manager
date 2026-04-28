import { getSupabaseClient } from "@/lib/supabase";
import { dailyHalacha, getTodayIsoDate, todayPrayerSchedule, type PrayerSlot } from "@/lib/data/mock-content";
import { getSefariaDailyHalachaSummary } from "@/lib/data/sefaria-halacha";
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

export async function getPublicHomeData() {
  // Supabase reads should always be fresh on page refresh (avoid Route Cache).
  noStore();

  const todayJerusalem = getTodayIsoDate();
  const now = new Date();
  const todayUtc = getIsoDateUtc(now);
  const yesterdayUtc = getIsoDateUtc(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const candidateDates = Array.from(new Set([todayJerusalem, todayUtc, yesterdayUtc]));
  const supabase = getSupabaseClient();

  if (!supabase) {
    const sefariaHalacha = await getSefariaDailyHalachaSummary();
    return {
      schedule: todayPrayerSchedule,
      halacha: sefariaHalacha ?? dailyHalacha
    };
  }

  const [prayerResult, halachaResult, sefariaHalacha] = await Promise.all([
    supabase
      .from("prayer_schedules")
      .select("id, schedule_date, prayer_type, prayer_time, minyan_label, notes")
      .in("schedule_date", candidateDates)
      .eq("published", true)
      .order("schedule_date", { ascending: false })
      .order("prayer_time", { ascending: true }),
    supabase
      .from("daily_halacha")
      .select("title, content")
      .in("halacha_date", candidateDates)
      .eq("published", true)
      .order("halacha_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSefariaDailyHalachaSummary()
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

  const dbHalacha =
    halachaResult.error || !halachaResult.data
      ? null
      : {
          title: halachaResult.data.title,
          text: halachaResult.data.content
        };

  const halacha = sefariaHalacha ?? dbHalacha ?? dailyHalacha;

  return { schedule, halacha };
}
