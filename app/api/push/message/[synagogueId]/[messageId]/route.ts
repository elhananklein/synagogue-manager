import { NextResponse } from "next/server";
import { getPushMessage } from "@/lib/push-db";
import { isPushNotificationsEnabled } from "@/lib/push-feature";
import { parseSynagogueId } from "@/lib/synagogue-id";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ synagogueId: string; messageId: string }> }
) {
  const { synagogueId: rawId, messageId } = await context.params;
  const synagogueId = parseSynagogueId(rawId);
  if (!synagogueId || !messageId?.trim()) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }
  if (!isPushNotificationsEnabled(synagogueId)) {
    return NextResponse.json({ ok: false, error: "push_not_enabled" }, { status: 403 });
  }

  const message = await getPushMessage(synagogueId, messageId.trim());
  if (message.error === "not_found" || !message.row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (message.error) {
    return NextResponse.json({ ok: false, error: message.error }, { status: 500 });
  }

  // רק הודעות שנשלחו / בתהליך — לא טיוטות מתוזמנות שטרם הגיע זמנן
  if (message.row.status === "scheduled" || message.row.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "not_ready" }, { status: 404 });
  }

  let synagogueName = "בית הכנסת";
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const res = await supabase.from("synagogues").select("name").eq("id", synagogueId).maybeSingle();
    if (!res.error && res.data?.name) synagogueName = String(res.data.name);
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: message.row.id,
      title: message.row.title,
      body: message.row.body,
      sentAt: message.row.sentAt,
      synagogueId,
      synagogueName
    }
  });
}
