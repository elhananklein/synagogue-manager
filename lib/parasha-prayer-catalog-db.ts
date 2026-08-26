import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeClockTime, type ParashaPrayerCatalogRow } from "@/lib/parasha-prayer-catalog";

export async function getParashaPrayerCatalog(
  minyanId: string | null | undefined
): Promise<ParashaPrayerCatalogRow[]> {
  if (!minyanId?.trim()) return [];
  const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();
  if (!supabase) return [];
  const res = await supabase
    .from("minyan_parasha_prayer_times")
    .select("parasha_key, mincha_time, maariv_time, sort_order")
    .eq("minyan_id", minyanId)
    .order("sort_order", { ascending: true });
  if (res.error || !res.data?.length) return [];
  return res.data
    .map((row) => ({
      parashaKey: typeof row.parasha_key === "string" ? row.parasha_key : "",
      minchaTime: normalizeClockTime(row.mincha_time),
      maarivTime: normalizeClockTime(row.maariv_time)
    }))
    .filter((row) => row.parashaKey);
}

export async function getParashaPrayerCatalogByMinyanIds(
  minyanIds: string[]
): Promise<Record<string, ParashaPrayerCatalogRow[]>> {
  const result: Record<string, ParashaPrayerCatalogRow[]> = {};
  for (const id of minyanIds) result[id] = [];
  if (!minyanIds.length) return result;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return result;
  const res = await supabase
    .from("minyan_parasha_prayer_times")
    .select("minyan_id, parasha_key, mincha_time, maariv_time, sort_order")
    .in("minyan_id", minyanIds)
    .order("sort_order", { ascending: true });
  if (res.error || !res.data?.length) return result;
  for (const row of res.data) {
    const minyanId = typeof row.minyan_id === "string" ? row.minyan_id : "";
    const parashaKey = typeof row.parasha_key === "string" ? row.parasha_key : "";
    if (!minyanId || !parashaKey || !result[minyanId]) continue;
    result[minyanId].push({
      parashaKey,
      minchaTime: normalizeClockTime(row.mincha_time),
      maarivTime: normalizeClockTime(row.maariv_time)
    });
  }
  return result;
}
