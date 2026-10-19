import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listDuePushMessages } from "@/lib/push-db";
import { isPushNotificationsEnabled } from "@/lib/push-feature";
import { deliverPushMessage } from "@/lib/push-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const due = await listDuePushMessages(50);
  if (due.error) {
    return NextResponse.json({ ok: false, error: due.error }, { status: 500 });
  }

  const results: Array<{ id: string; ok: boolean; successCount: number; failCount: number; error?: string }> = [];
  for (const message of due.rows) {
    if (!isPushNotificationsEnabled(message.synagogueId)) continue;
    const delivered = await deliverPushMessage(message);
    results.push({
      id: message.id,
      ok: delivered.ok,
      successCount: delivered.successCount,
      failCount: delivered.failCount,
      error: delivered.ok ? undefined : delivered.error
    });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
