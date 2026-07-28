import { unlink } from "fs/promises";
import path from "path";
import { todayJerusalemIso } from "@/lib/bulletin-board-dates";
import type { BulletinItem, BulletinItemInput } from "@/lib/bulletin-board-types";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";

export type { BulletinItem, BulletinItemInput, BulletinItemKind } from "@/lib/bulletin-board-types";
export { addDaysIsoDate, todayJerusalemIso } from "@/lib/bulletin-board-dates";
type DbRow = {
  id: string;
  kind: string;
  title: string | null;
  body_text: string | null;
  image_url: string | null;
  sort_order: number;
  published: boolean;
  display_from: string;
  display_until: string;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeIsoDate(raw: string | null | undefined, fallback: string) {
  if (typeof raw === "string" && ISO_DATE_RE.test(raw.slice(0, 10))) return raw.slice(0, 10);
  return fallback;
}

function mapRow(row: DbRow): BulletinItem {
  const today = todayJerusalemIso();
  return {
    id: row.id,
    kind: row.kind === "image" ? "image" : "text",
    title: row.title,
    bodyText: row.body_text,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    published: row.published,
    displayFrom: normalizeIsoDate(row.display_from, today),
    displayUntil: normalizeIsoDate(row.display_until, today)
  };
}

function localBulletinImageAbsPath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl?.startsWith("/uploads/bulletin/")) return null;
  const rel = imageUrl.replace(/^\//, "").replace(/\//g, path.sep);
  return path.join(process.cwd(), "public", rel);
}

async function deleteLocalBulletinImage(imageUrl: string | null | undefined) {
  const abs = localBulletinImageAbsPath(imageUrl);
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    /* הקובץ כבר לא קיים */
  }
}

export type PurgeExpiredResult = {
  deletedRows: number;
  deletedImages: number;
};

async function purgeExpiredBulletinItemsInternal(synagogueId?: string): Promise<PurgeExpiredResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { deletedRows: 0, deletedImages: 0 };

  const today = todayJerusalemIso();
  let expiredQuery = supabase
    .from("synagogue_bulletin_items")
    .select("id, image_url")
    .lt("display_until", today);

  if (synagogueId) {
    expiredQuery = expiredQuery.eq("synagogue_id", synagogueId);
  }

  const expiredRes = await expiredQuery;
  if (expiredRes.error || !expiredRes.data?.length) {
    return { deletedRows: 0, deletedImages: 0 };
  }

  let deletedImages = 0;
  for (const row of expiredRes.data) {
    if (row.image_url?.startsWith("/uploads/bulletin/")) {
      await deleteLocalBulletinImage(row.image_url);
      deletedImages += 1;
    }
  }

  let deleteQuery = supabase.from("synagogue_bulletin_items").delete().lt("display_until", today);
  if (synagogueId) {
    deleteQuery = deleteQuery.eq("synagogue_id", synagogueId);
  }

  const deleteRes = await deleteQuery.select("id");
  if (deleteRes.error) {
    return { deletedRows: 0, deletedImages };
  }

  return {
    deletedRows: deleteRes.data?.length ?? expiredRes.data.length,
    deletedImages
  };
}

/** מוחק הודעות שעבר תאריך הסיום שלהן + קבצי תמונה מקומיים (בית כנסת בודד). */
export async function purgeExpiredBulletinItems(synagogueId: string): Promise<void> {
  await purgeExpiredBulletinItemsInternal(synagogueId);
}

/** מוחק הודעות שפג תוקפן בכל בתי הכנסת — לשימוש ב-cron יומי. */
export async function purgeAllExpiredBulletinItems(): Promise<PurgeExpiredResult> {
  return purgeExpiredBulletinItemsInternal();
}

async function deleteOrphanedBulletinImages(
  synagogueId: string,
  nextItems: BulletinItemInput[]
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const existingRes = await supabase
    .from("synagogue_bulletin_items")
    .select("image_url")
    .eq("synagogue_id", synagogueId);

  if (existingRes.error || !existingRes.data?.length) return;

  const keepUrls = new Set(
    nextItems.map((item) => item.imageUrl?.trim()).filter((url): url is string => Boolean(url))
  );

  for (const row of existingRes.data) {
    const url = row.image_url;
    if (url && !keepUrls.has(url)) {
      await deleteLocalBulletinImage(url);
    }
  }
}

export async function getPublishedBulletinItems(synagogueId: string | null | undefined): Promise<BulletinItem[]> {
  if (!synagogueId?.trim()) return [];
  await purgeExpiredBulletinItems(synagogueId);

  const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();
  if (!supabase) return [];

  const today = todayJerusalemIso();
  const res = await supabase
    .from("synagogue_bulletin_items")
    .select("id, kind, title, body_text, image_url, sort_order, published, display_from, display_until")
    .eq("synagogue_id", synagogueId)
    .eq("published", true)
    .lte("display_from", today)
    .gte("display_until", today)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (res.error || !res.data?.length) return [];
  return (res.data as DbRow[]).map(mapRow);
}

export async function getAllBulletinItemsForAdmin(synagogueId: string): Promise<BulletinItem[]> {
  await purgeExpiredBulletinItems(synagogueId);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const res = await supabase
    .from("synagogue_bulletin_items")
    .select("id, kind, title, body_text, image_url, sort_order, published, display_from, display_until")
    .eq("synagogue_id", synagogueId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (res.error || !res.data) return [];
  return (res.data as DbRow[]).map(mapRow);
}

export async function saveBulletinItems(
  synagogueId: string,
  items: BulletinItemInput[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "missing_service_role_key" };

  for (const item of items) {
    if (item.kind === "text" && !item.bodyText?.trim() && !item.title?.trim()) {
      return { ok: false, error: "bulletin_text_requires_content" };
    }
    if (item.kind === "image" && !item.imageUrl?.trim()) {
      return { ok: false, error: "bulletin_image_requires_url" };
    }
    const from = item.displayFrom?.trim().slice(0, 10) ?? "";
    const until = item.displayUntil?.trim().slice(0, 10) ?? "";
    if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(until)) {
      return { ok: false, error: "bulletin_invalid_dates" };
    }
    if (until < from) {
      return { ok: false, error: "bulletin_until_before_from" };
    }
  }

  await purgeExpiredBulletinItems(synagogueId);
  await deleteOrphanedBulletinImages(synagogueId, items);

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
    published: item.published !== false,
    display_from: item.displayFrom.trim().slice(0, 10),
    display_until: item.displayUntil.trim().slice(0, 10)
  }));

  const { error: insertError } = await supabase.from("synagogue_bulletin_items").insert(rows);
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true };
}
