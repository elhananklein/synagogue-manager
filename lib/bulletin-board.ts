import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";

export type BulletinItemKind = "text" | "image";

export type BulletinItem = {
  id: string;
  kind: BulletinItemKind;
  title: string | null;
  bodyText: string | null;
  imageUrl: string | null;
  sortOrder: number;
  published: boolean;
};

export type BulletinItemInput = {
  id?: string;
  kind: BulletinItemKind;
  title?: string | null;
  bodyText?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  published: boolean;
};

type DbRow = {
  id: string;
  kind: string;
  title: string | null;
  body_text: string | null;
  image_url: string | null;
  sort_order: number;
  published: boolean;
};

function mapRow(row: DbRow): BulletinItem {
  return {
    id: row.id,
    kind: row.kind === "image" ? "image" : "text",
    title: row.title,
    bodyText: row.body_text,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    published: row.published
  };
}

export async function getPublishedBulletinItems(synagogueId: string | null | undefined): Promise<BulletinItem[]> {
  if (!synagogueId?.trim()) return [];
  const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();
  if (!supabase) return [];

  const res = await supabase
    .from("synagogue_bulletin_items")
    .select("id, kind, title, body_text, image_url, sort_order, published")
    .eq("synagogue_id", synagogueId)
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (res.error || !res.data?.length) return [];
  return (res.data as DbRow[]).map(mapRow);
}

export async function getAllBulletinItemsForAdmin(synagogueId: string): Promise<BulletinItem[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const res = await supabase
    .from("synagogue_bulletin_items")
    .select("id, kind, title, body_text, image_url, sort_order, published")
    .eq("synagogue_id", synagogueId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (res.error || !res.data) return [];
  return (res.data as DbRow[]).map(mapRow);
}

export async function saveBulletinItems(synagogueId: string, items: BulletinItemInput[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "missing_service_role_key" };

  for (const item of items) {
    if (item.kind === "text" && !item.bodyText?.trim() && !item.title?.trim()) {
      return { ok: false, error: "bulletin_text_requires_content" };
    }
    if (item.kind === "image" && !item.imageUrl?.trim()) {
      return { ok: false, error: "bulletin_image_requires_url" };
    }
  }

  const { error: deleteError } = await supabase.from("synagogue_bulletin_items").delete().eq("synagogue_id", synagogueId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (!items.length) return { ok: true };

  const rows = items.map((item, index) => ({
    synagogue_id: synagogueId,
    kind: item.kind,
    title: item.title?.trim() || null,
    body_text: item.bodyText?.trim() || null,
    image_url: item.imageUrl?.trim() || null,
    sort_order: item.sortOrder ?? index + 1,
    published: item.published !== false
  }));

  const { error: insertError } = await supabase.from("synagogue_bulletin_items").insert(rows);
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true };
}
