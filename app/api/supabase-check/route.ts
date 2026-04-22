import { getSupabaseClient, hasSupabaseEnv } from "@/lib/supabase";
import { getTodayIsoDate } from "@/lib/data/mock-content";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getIsoDateUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const todayJerusalem = getTodayIsoDate();
  const now = new Date();
  const todayUtc = getIsoDateUtc(now);
  const yesterdayUtc = getIsoDateUtc(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const candidateDates = Array.from(new Set([todayJerusalem, todayUtc, yesterdayUtc]));
  const supabase = getSupabaseClient();

  if (!hasSupabaseEnv() || !supabase) {
    return NextResponse.json(
      {
        ok: false,
        reason: "missing_env",
        todayJerusalem
      },
      { status: 500 }
    );
  }

  const [prayerForCandidates, halachaForCandidates, latestHalacha] = await Promise.all([
    supabase
      .from("prayer_schedules")
      .select("id, schedule_date, prayer_type, minyan_label, prayer_time, notes, published")
      .in("schedule_date", candidateDates)
      .eq("published", true)
      .order("schedule_date", { ascending: false })
      .order("prayer_time", { ascending: true })
      .limit(20),
    supabase
      .from("daily_halacha")
      .select("id, halacha_date, title, published")
      .in("halacha_date", candidateDates)
      .eq("published", true)
      .order("halacha_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("daily_halacha")
      .select("id, halacha_date, title, published")
      .eq("published", true)
      .order("halacha_date", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  return NextResponse.json({
    ok: true,
    todayJerusalem,
    todayUtc,
    candidateDates,
    prayer: {
      count: prayerForCandidates.data?.length ?? 0,
      error: prayerForCandidates.error,
      sample: prayerForCandidates.data?.slice(0, 3) ?? []
    },
    halacha: {
      found: Boolean(halachaForCandidates.data),
      error: halachaForCandidates.error,
      row: halachaForCandidates.data ?? null
    },
    latestHalacha: {
      found: Boolean(latestHalacha.data),
      error: latestHalacha.error,
      row: latestHalacha.data ?? null
    }
  });
}

