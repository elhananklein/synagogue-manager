import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { isPushNotificationsEnabled } from "@/lib/push-feature";
import {
  cancelPushMessage,
  countPushSubscriptions,
  insertPushMessage,
  listDuePushMessages,
  listPushMessages
} from "@/lib/push-db";
import { deliverPushMessage } from "@/lib/push-send";
import { PUSH_BODY_MAX, PUSH_TEMPLATES, PUSH_TITLE_MAX } from "@/lib/push-types";
import { listSynagogueMinyanOptions } from "@/lib/congregant-db";
import { vapidConfigured } from "@/lib/push-vapid";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;
  if (!isPushNotificationsEnabled(access.synagogueId)) {
    return NextResponse.json({ ok: false, error: "push_not_enabled" }, { status: 403 });
  }

  // שטיפת תזמונים שכבר הגיע זמנם (נוח לבדיקות; גם אם ה-cron ב-Vercel מוגבל)
  if (vapidConfigured()) {
    const due = await listDuePushMessages(20);
    for (const row of due.rows) {
      if (row.synagogueId !== access.synagogueId) continue;
      if (!isPushNotificationsEnabled(row.synagogueId)) continue;
      await deliverPushMessage(row);
    }
  }

  const [subs, messages, minyanim] = await Promise.all([
    countPushSubscriptions(access.synagogueId),
    listPushMessages(access.synagogueId),
    listSynagogueMinyanOptions(access.synagogueId)
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      enabled: true,
      vapidReady: vapidConfigured(),
      subscriberCount: subs.count,
      tablesReady: subs.error !== "missing_push_tables" && messages.error !== "missing_push_tables",
      missingTables: subs.error === "missing_push_tables" || messages.error === "missing_push_tables",
      messages: messages.rows,
      minyanim,
      templates: PUSH_TEMPLATES
    }
  });
}

type SendBody = {
  title?: string;
  body?: string;
  templateKey?: string | null;
  minyanId?: string | null;
  scheduledFor?: string | null;
  sendNow?: boolean;
};

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;
  if (!isPushNotificationsEnabled(access.synagogueId)) {
    return NextResponse.json({ ok: false, error: "push_not_enabled" }, { status: 403 });
  }
  if (!vapidConfigured()) {
    return NextResponse.json({ ok: false, error: "missing_vapid" }, { status: 503 });
  }

  const payload = (await request.json()) as SendBody;
  const title = String(payload.title ?? "").trim();
  const body = String(payload.body ?? "").trim();
  if (!title || title.length > PUSH_TITLE_MAX) {
    return NextResponse.json({ ok: false, error: "invalid_title" }, { status: 400 });
  }
  if (!body || body.length > PUSH_BODY_MAX) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const minyanId =
    typeof payload.minyanId === "string" && payload.minyanId.trim() ? payload.minyanId.trim() : null;
  const templateKey =
    typeof payload.templateKey === "string" && payload.templateKey.trim() ? payload.templateKey.trim() : null;

  const scheduledRaw = typeof payload.scheduledFor === "string" ? payload.scheduledFor.trim() : "";
  const sendNow = payload.sendNow !== false && !scheduledRaw;
  let scheduledFor: string | null = null;
  if (!sendNow && scheduledRaw) {
    const when = new Date(scheduledRaw);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ ok: false, error: "invalid_schedule" }, { status: 400 });
    }
    if (when.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ ok: false, error: "schedule_in_past" }, { status: 400 });
    }
    scheduledFor = when.toISOString();
  } else {
    scheduledFor = new Date().toISOString();
  }

  const created = await insertPushMessage({
    synagogueId: access.synagogueId,
    minyanId,
    title,
    body,
    templateKey,
    status: "scheduled",
    scheduledFor,
    createdBy: access.ctx.email || access.ctx.userId
  });
  if (created.error || !created.row) {
    return NextResponse.json({ ok: false, error: created.error ?? "save_failed" }, { status: 400 });
  }

  const shouldSendImmediately = sendNow || (scheduledFor && new Date(scheduledFor).getTime() <= Date.now() + 5_000);
  if (!shouldSendImmediately) {
    return NextResponse.json({ ok: true, data: { message: created.row, delivered: false } });
  }

  const delivered = await deliverPushMessage(created.row);
  const refreshed = await listPushMessages(access.synagogueId, 1);
  return NextResponse.json({
    ok: true,
    data: {
      message: refreshed.rows[0] ?? created.row,
      delivered: delivered.ok,
      successCount: delivered.successCount,
      failCount: delivered.failCount,
      error: delivered.ok ? undefined : delivered.error
    }
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;
  if (!isPushNotificationsEnabled(access.synagogueId)) {
    return NextResponse.json({ ok: false, error: "push_not_enabled" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("messageId")?.trim();
  if (!messageId) {
    return NextResponse.json({ ok: false, error: "missing_message_id" }, { status: 400 });
  }
  const cancelled = await cancelPushMessage(access.synagogueId, messageId);
  if (cancelled.error || !cancelled.row) {
    return NextResponse.json({ ok: false, error: cancelled.error ?? "not_found" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, data: cancelled.row });
}
