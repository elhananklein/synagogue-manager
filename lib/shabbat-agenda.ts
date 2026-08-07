import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";

export type ShabbatAgendaItem = {
  id: string;
  sortOrder: number;
  /** שעה אופציונלית בפורמט HH:MM */
  itemTime: string | null;
  content: string;
  published: boolean;
};

export type ShabbatAgendaItemInput = {
  id?: string;
  sortOrder: number;
  itemTime?: string | null;
  content: string;
  published?: boolean;
};

type DbRow = {
  id: string;
  minyan_id?: string;
  sort_order: number;
  item_time: string | null;
  content: string;
  published: boolean;
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
    published: row.published !== false
  };
}

export async function getPublishedShabbatAgendaItems(
  minyanId: string | null | undefined
): Promise<ShabbatAgendaItem[]> {
  if (!minyanId?.trim()) return [];

  const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();
  if (!supabase) return [];

  const res = await supabase
    .from("minyan_shabbat_agenda_items")
    .select("id, sort_order, item_time, content, published")
    .eq("minyan_id", minyanId)
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

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

  const res = await supabase
    .from("minyan_shabbat_agenda_items")
    .select("id, minyan_id, sort_order, item_time, content, published")
    .in("minyan_id", minyanIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

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

  for (const item of items) {
    if (!item.content?.trim()) {
      return { ok: false, error: "shabbat_agenda_requires_content" };
    }
    const time = normalizeItemTime(item.itemTime);
    if (item.itemTime != null && String(item.itemTime).trim() && !time) {
      return { ok: false, error: "shabbat_agenda_invalid_time" };
    }
  }

  const { error: deleteError } = await supabase
    .from("minyan_shabbat_agenda_items")
    .delete()
    .eq("minyan_id", minyanId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (!items.length) return { ok: true };

  const rows = items.map((item, index) => ({
    minyan_id: minyanId,
    sort_order: item.sortOrder ?? index + 1,
    item_time: normalizeItemTime(item.itemTime),
    content: item.content.trim(),
    published: item.published !== false
  }));

  const { error: insertError } = await supabase.from("minyan_shabbat_agenda_items").insert(rows);
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true };
}
