import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { canManageSynagogue, getAdminContext } from "@/lib/auth";
import { storeBulletinImage } from "@/lib/bulletin-image-storage";
import { sniffImageMime } from "@/lib/synagogue-logo-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Vercel חוסם גוף בקשה מעל 4.5MB — הדפדפן מקטין לפני השליחה */
const MAX_BYTES = 4.5 * 1024 * 1024;

function isGif(buffer: Buffer) {
  return buffer.length >= 6 && buffer.toString("ascii", 0, 3) === "GIF";
}

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId } = await context.params;

  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!canManageSynagogue(ctx, synagogueId))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }

  const synagogueRes = await supabase.from("synagogues").select("id").eq("id", synagogueId).maybeSingle();
  if (synagogueRes.error || !synagogueRes.data) {
    return NextResponse.json({ ok: false, error: "synagogue_not_found" }, { status: 404 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffImageMime(buffer, file.type) && !isGif(buffer)) {
    return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400 });
  }

  try {
    const url = await storeBulletinImage(synagogueId, buffer);
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("bulletin upload failed", message);
    return NextResponse.json({ ok: false, error: "storage_failed" }, { status: 500 });
  }
}
