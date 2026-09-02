import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { canManageSynagogue, getAdminContext } from "@/lib/auth";
import { parseSynagogueId } from "@/lib/synagogue-id";
import { deleteSynagoguePwaIcons, synagogueLogoPublicUrl, writeSynagoguePwaIcons } from "@/lib/synagogue-logo-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

async function requireLogoAccess(synagogueId: string) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!canManageSynagogue(ctx, synagogueId)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }
  const synagogueRes = await supabase.from("synagogues").select("id").eq("id", synagogueId).maybeSingle();
  if (synagogueRes.error || !synagogueRes.data) {
    return NextResponse.json({ ok: false, error: "synagogue_not_found" }, { status: 404 });
  }
  return { supabase };
}

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const synagogueId = parseSynagogueId(rawId);
  if (!synagogueId) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const access = await requireLogoAccess(synagogueId);
  if (access instanceof NextResponse) return access;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
  }

  try {
    await writeSynagoguePwaIcons(synagogueId, Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ ok: false, error: "logo_process_failed" }, { status: 500 });
  }

  const logoUrl = synagogueLogoPublicUrl(synagogueId);
  const logoUpdatedAt = new Date().toISOString();
  const { error } = await access.supabase
    .from("synagogues")
    .update({ logo_url: logoUrl, logo_updated_at: logoUpdatedAt })
    .eq("id", synagogueId);
  if (error) {
    return NextResponse.json({ ok: false, error: "logo_column_missing" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, logoUrl, logoUpdatedAt });
}

export async function DELETE(_request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const synagogueId = parseSynagogueId(rawId);
  if (!synagogueId) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const access = await requireLogoAccess(synagogueId);
  if (access instanceof NextResponse) return access;

  await deleteSynagoguePwaIcons(synagogueId);
  const { error } = await access.supabase
    .from("synagogues")
    .update({ logo_url: null, logo_updated_at: null })
    .eq("id", synagogueId);
  if (error) {
    return NextResponse.json({ ok: false, error: "logo_column_missing" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, logoUrl: null, logoUpdatedAt: null });
}
