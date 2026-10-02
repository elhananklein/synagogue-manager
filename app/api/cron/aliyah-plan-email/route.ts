import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { sendAliyahPlanEmail } from "@/lib/aliyah-plan-email";
import { addDaysIso, aliyahDayKind, jerusalemTodayIso } from "@/lib/aliyah-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ACTIVE_HISTORY_DAYS = 120;

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

/** ימי הקריאה הרצופים שמתחילים מחר — רק כשהיום עצמו אינו יום קריאה (ערב שבת / ערב חג). */
function upcomingServiceDates(todayIso: string): string[] {
  if (aliyahDayKind(todayIso) !== "other") return [];
  const out: string[] = [];
  for (let offset = 1; offset <= 3; offset += 1) {
    const iso = addDaysIso(todayIso, offset);
    if (aliyahDayKind(iso) === "other") break;
    out.push(iso);
  }
  return out;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const today = jerusalemTodayIso();
  const dates = upcomingServiceDates(today);
  if (!dates.length) return NextResponse.json({ ok: true, today, skipped: "not_erev" });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });

  // מניינים פעילים: מי שהפעיל מייל בהגדרות, או מי שרשם עליות לאחרונה (ולא כיבה את המייל).
  const [settingsRes, sessionsRes] = await Promise.all([
    supabase.from("minyan_aliyah_settings").select("minyan_id, synagogue_id, email_enabled"),
    supabase
      .from("aliyah_sessions")
      .select("minyan_id, synagogue_id")
      .gte("service_date", addDaysIso(today, -ACTIVE_HISTORY_DAYS))
  ]);
  const targets = new Map<string, string>();
  const disabled = new Set<string>();
  for (const row of settingsRes.data ?? []) {
    if (row.email_enabled) targets.set(String(row.minyan_id), String(row.synagogue_id));
    else disabled.add(String(row.minyan_id));
  }
  for (const row of sessionsRes.data ?? []) {
    const minyanId = String(row.minyan_id);
    if (!disabled.has(minyanId)) targets.set(minyanId, String(row.synagogue_id));
  }

  const results: Array<{ minyanId: string; ok: boolean; error?: string }> = [];
  for (const [minyanId, synagogueId] of targets) {
    try {
      const res = await sendAliyahPlanEmail(synagogueId, minyanId, dates, { requireEnabled: true });
      results.push({ minyanId, ok: res.ok, error: res.error });
    } catch (error) {
      results.push({ minyanId, ok: false, error: error instanceof Error ? error.message : "send_failed" });
    }
  }
  return NextResponse.json({ ok: true, today, dates, results });
}
