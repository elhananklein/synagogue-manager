import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId } = await context.params;
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }

  const synagogueRes = await supabase.from("synagogues").select("id").eq("id", synagogueId).maybeSingle();
  if (synagogueRes.error || !synagogueRes.data) {
    return NextResponse.json({ ok: false, error: "synagogue_not_found" }, { status: 404 });
  }

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

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const relDir = path.join("uploads", "bulletin", synagogueId);
  const absDir = path.join(process.cwd(), "public", relDir);
  await mkdir(absDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(absDir, filename), buffer);

  const url = `/${relDir.replace(/\\/g, "/")}/${filename}`;
  return NextResponse.json({ ok: true, url });
}
