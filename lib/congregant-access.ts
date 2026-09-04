import { NextResponse } from "next/server";
import { canManageSynagogue, getAdminContext } from "@/lib/auth";
import { parseSynagogueId } from "@/lib/synagogue-id";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export async function requireGabbaiSynagogue(rawId: string) {
  const synagogueId = parseSynagogueId(rawId);
  if (!synagogueId) {
    return { error: NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 }) };
  }
  const ctx = await getAdminContext();
  if (!ctx) {
    return { error: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  }
  if (!canManageSynagogue(ctx, synagogueId)) {
    return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { error: NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 }) };
  }
  return { synagogueId, supabase };
}
