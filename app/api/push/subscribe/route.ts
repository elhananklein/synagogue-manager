import { NextResponse } from "next/server";
import { isPushNotificationsEnabled } from "@/lib/push-feature";
import { upsertPushSubscription, deletePushSubscriptionByEndpoint } from "@/lib/push-db";
import { parseSynagogueId } from "@/lib/synagogue-id";
import { vapidConfigured } from "@/lib/push-vapid";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  synagogueId?: string;
  minyanId?: string | null;
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(request: Request) {
  if (!vapidConfigured()) {
    return NextResponse.json({ ok: false, error: "missing_vapid" }, { status: 503 });
  }
  const body = (await request.json()) as Body;
  const synagogueId = parseSynagogueId(body.synagogueId ?? "");
  if (!synagogueId || !isPushNotificationsEnabled(synagogueId)) {
    return NextResponse.json({ ok: false, error: "push_not_enabled" }, { status: 403 });
  }
  const endpoint = String(body.endpoint ?? "").trim();
  const p256dh = String(body.keys?.p256dh ?? "").trim();
  const auth = String(body.keys?.auth ?? "").trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "invalid_subscription" }, { status: 400 });
  }
  const minyanId =
    typeof body.minyanId === "string" && body.minyanId.trim() ? body.minyanId.trim() : null;
  const userAgent = request.headers.get("user-agent");
  const saved = await upsertPushSubscription({
    synagogueId,
    minyanId,
    endpoint,
    p256dh,
    auth,
    userAgent
  });
  if (saved.error || !saved.row) {
    return NextResponse.json({ ok: false, error: saved.error ?? "save_failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, data: { id: saved.row.id } });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { endpoint?: string };
  const endpoint = String(body.endpoint ?? "").trim();
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: "invalid_subscription" }, { status: 400 });
  }
  const result = await deletePushSubscriptionByEndpoint(endpoint);
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
