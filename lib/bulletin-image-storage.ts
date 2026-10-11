import { unlink } from "fs/promises";
import path from "path";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

const BULLETIN_BUCKET = "bulletin-images";
/** מספיק למסך 1080p/4K בלי להכביד על טלוויזיה באינטרנט חלש */
const MAX_EDGE = 1920;
const PUBLIC_MARKER = `/storage/v1/object/public/${BULLETIN_BUCKET}/`;

async function ensureBulletinBucket() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("missing_service_role_key");
  const existing = await supabase.storage.getBucket(BULLETIN_BUCKET);
  if (existing.data) return supabase;
  const created = await supabase.storage.createBucket(BULLETIN_BUCKET, {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/jpeg"]
  });
  if (created.error && !/already exists|duplicate/i.test(created.error.message)) {
    throw new Error(created.error.message);
  }
  return supabase;
}

/** מקטין, מסובב לפי EXIF ושומר כ־JPEG ב־Supabase Storage. מחזיר כתובת ציבורית. */
export async function storeBulletinImage(synagogueId: string, source: Buffer): Promise<string> {
  const { default: sharp } = await import("sharp");
  const jpeg = await sharp(source, { failOn: "none" })
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const supabase = await ensureBulletinBucket();
  const objectPath = `${synagogueId}/${crypto.randomUUID()}.jpg`;
  const uploaded = await supabase.storage.from(BULLETIN_BUCKET).upload(objectPath, jpeg, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false
  });
  if (uploaded.error) throw new Error(uploaded.error.message);
  return supabase.storage.from(BULLETIN_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

export function isManagedBulletinImageUrl(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  return imageUrl.startsWith("/uploads/bulletin/") || imageUrl.includes(PUBLIC_MARKER);
}

/** מוחק תמונה שהועלתה דרך המערכת (Storage או קובץ מקומי ישן). כתובות חיצוניות לא נוגעים. */
export async function deleteBulletinImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) return;
  if (imageUrl.startsWith("/uploads/bulletin/")) {
    const rel = imageUrl.replace(/^\//, "").replace(/\//g, path.sep);
    await unlink(path.join(process.cwd(), "public", rel)).catch(() => undefined);
    return;
  }
  const markerIndex = imageUrl.indexOf(PUBLIC_MARKER);
  if (markerIndex < 0) return;
  const objectPath = decodeURIComponent(imageUrl.slice(markerIndex + PUBLIC_MARKER.length).split("?")[0]);
  const supabase = getSupabaseAdminClient();
  if (!supabase || !objectPath) return;
  await supabase.storage
    .from(BULLETIN_BUCKET)
    .remove([objectPath])
    .catch(() => undefined);
}
