import { normalizeOccasionDay, type OccasionDayIndex } from "@/lib/sacred-occasion";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";

export type ShabbatAgendaItem = {
  id: string;
  sortOrder: number;
  /** שעה אופציונלית בפורמט HH:MM */
  itemTime: string | null;
  content: string;
  published: boolean;
  occasionDay: OccasionDayIndex;
};

export type ShabbatAgendaItemInput = {
  id?: string;
  sortOrder: number;
  itemTime?: string | null;
  content: string;
  published?: boolean;
  occasionDay?: number | null;
};

type DbRow = {
  id: string;
  minyan_id?: string;
  sort_order: number;
  item_time: string | null;
  content: string;
  published: boolean;
  occasion_day?: number | null;
};

const TIME_RE = /^\d{2}:\d{2}$/;

function normalizeItemTime(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const hhmm = trimmed.slice(0, 5);
  if (!TIME_RE.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return hhmm;
}

function mapRow(row: DbRow): ShabbatAgendaItem {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    itemTime: normalizeItemTime(row.item_time),
    content: row.content ?? "",
    published: row.published !== false,
    occasionDay: normalizeOccasionDay(row.occasion_day)
  };
}

const AGENDA_SELECT = "id, sort_order, item_time, content, published, occasion_day";

export async function getPublishedShabbatAgendaItems(
  minyanId: string | null | undefined
): Promise<ShabbatAgendaItem[]> {
  if (!minyanId?.trim()) return [];

  const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();
  if (!supabase) return [];

  const withDay = await supabase
    .from("minyan_shabbat_agenda_items")
    .select(AGENDA_SELECT)
    .eq("minyan_id", minyanId)
    .eq("published", true)
    .order("occasion_day", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const res =
    withDay.error && /occasion_day/i.test(withDay.error.message)
      ? await supabase
          .from("minyan_shabbat_agenda_items")
          .select("id, sort_order, item_time, content, published")
          .eq("minyan_id", minyanId)
          .eq("published", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : withDay;

  if (res.error || !res.data?.length) return [];
  return (res.data as DbRow[])
    .map(mapRow)
    .filter((item) => item.content.trim().length > 0);
}

/** טוען לוחות שבת לכל המניינים — לממשק גבאי */
export async function getShabbatAgendaItemsByMinyanIds(
  minyanIds: string[]
): Promise<Record<string, ShabbatAgendaItem[]>> {
  const result: Record<string, ShabbatAgendaItem[]> = {};
  for (const id of minyanIds) result[id] = [];
  if (!minyanIds.length) return result;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return result;

  const withDay = await supabase
    .from("minyan_shabbat_agenda_items")
    .select("id, minyan_id, sort_order, item_time, content, published, occasion_day")
    .in("minyan_id", minyanIds)
    .order("occasion_day", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const res =
    withDay.error && /occasion_day/i.test(withDay.error.message)
      ? await supabase
          .from("minyan_shabbat_agenda_items")
          .select("id, minyan_id, sort_order, item_time, content, published")
          .in("minyan_id", minyanIds)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : withDay;

  if (res.error || !res.data) return result;

  for (const row of res.data as DbRow[]) {
    const mid = row.minyan_id;
    if (!mid) continue;
    if (!result[mid]) result[mid] = [];
    result[mid].push(mapRow(row));
  }
  return result;
}

export async function saveShabbatAgendaItems(
  minyanId: string,
  items: ShabbatAgendaItemInput[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "missing_service_role_key" };

  const prepared = items.filter((item) => item.content?.trim());
  for (const item of prepared) {
    const time = normalizeItemTime(item.itemTime);
    if (item.itemTime != null && String(item.itemTime).trim() && !time) {
      return { ok: false, error: "shabbat_agenda_invalid_time" };
    }
    const day = Number(item.occasionDay ?? 1);
    if (day !== 1 && day !== 2 && day !== 3) {
      return { ok: false, error: "shabbat_agenda_invalid_day" };
    }
  }

  const { error: deleteError } = await supabase
    .from("minyan_shabbat_agenda_items")
    .delete()
    .eq("minyan_id", minyanId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (!prepared.length) return { ok: true };

  const sorted = [...prepared].sort((a, b) => {
    const day = normalizeOccasionDay(a.occasionDay) - normalizeOccasionDay(b.occasionDay);
    if (day) return day;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  const rows = sorted.map((item, index) => ({
    minyan_id: minyanId,
    sort_order: item.sortOrder ?? index + 1,
    item_time: normalizeItemTime(item.itemTime),
    content: item.content.trim(),
    published: item.published !== false,
    occasion_day: normalizeOccasionDay(item.occasionDay)
  }));

  const { error: insertError } = await supabase.from("minyan_shabbat_agenda_items").insert(rows);
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true };
}
