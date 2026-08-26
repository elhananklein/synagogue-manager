import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { canManageSynagogue, getAdminContext } from "@/lib/auth";
import { fetchJerusalemParashaCatalogKeys } from "@/lib/parasha-catalog-hebcal";
import {
  normalizeClockTime,
  withParashaCatalogSelectKeys,
  type ParashaPrayerCatalogRow
} from "@/lib/parasha-prayer-catalog";

async function requireAccess(synagogueId: string) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!canManageSynagogue(ctx, synagogueId))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  return null;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId } = await context.params;
  const denied = await requireAccess(synagogueId);
  if (denied) return denied;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }

  const payload = (await request.json()) as {
    minyanId?: string;
    rows?: ParashaPrayerCatalogRow[];
  };
  const minyanId = payload.minyanId?.trim();
  if (!minyanId) {
    return NextResponse.json({ ok: false, error: "missing_minyan_id" }, { status: 400 });
  }

  const minyanRes = await supabase
    .from("minyanim")
    .select("id")
    .eq("id", minyanId)
    .eq("synagogue_id", synagogueId)
    .maybeSingle();
  if (minyanRes.error || !minyanRes.data) {
    return NextResponse.json({ ok: false, error: "minyan_not_found" }, { status: 404 });
  }

  const allowed = new Set(withParashaCatalogSelectKeys(await fetchJerusalemParashaCatalogKeys()));
  const seen = new Set<string>();
  const rows: ParashaPrayerCatalogRow[] = [];
  for (const raw of payload.rows ?? []) {
    const parashaKey = typeof raw.parashaKey === "string" ? raw.parashaKey.trim() : "";
    if (!parashaKey || seen.has(parashaKey)) continue;
    if (!allowed.has(parashaKey)) {
      return NextResponse.json({ ok: false, error: "unknown_parasha" }, { status: 400 });
    }
    const minchaTime = normalizeClockTime(raw.minchaTime);
    const maarivTime = normalizeClockTime(raw.maarivTime);
    if (!minchaTime && !maarivTime) continue;
    seen.add(parashaKey);
    rows.push({ parashaKey, minchaTime, maarivTime });
  }

  const { error: deleteError } = await supabase.from("minyan_parasha_prayer_times").delete().eq("minyan_id", minyanId);
  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
  }
  if (rows.length) {
    const { error: insertError } = await supabase.from("minyan_parasha_prayer_times").insert(
      rows.map((row, index) => ({
        minyan_id: minyanId,
        parasha_key: row.parashaKey,
        mincha_time: row.minchaTime,
        maariv_time: row.maarivTime,
        sort_order: index + 1
      }))
    );
    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, rows });
}
