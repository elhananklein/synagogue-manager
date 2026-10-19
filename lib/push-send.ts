import webpush from "web-push";
import {
  deleteDeadPushSubscription,
  finalizePushMessage,
  listPushSubscriptionsForSend,
  markPushMessageSending
} from "@/lib/push-db";
import { pushMessagePath, type PushMessageRecord } from "@/lib/push-types";
import { getVapidPrivateKey, getVapidPublicKey, getVapidSubject, vapidConfigured } from "@/lib/push-vapid";
import { getPublicSiteUrl } from "@/lib/site-url";

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return true;
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
  vapidReady = true;
  return true;
}

export async function deliverPushMessage(message: PushMessageRecord) {
  if (!vapidConfigured() || !ensureVapid()) {
    return { ok: false as const, error: "missing_vapid", successCount: 0, failCount: 0 };
  }

  const claimed = await markPushMessageSending(message.id);
  if (!claimed.ok) {
    return { ok: false as const, error: claimed.error ?? "already_sending", successCount: 0, failCount: 0 };
  }

  const subs = await listPushSubscriptionsForSend(message.synagogueId, message.minyanId);
  if (subs.error) {
    await finalizePushMessage(message.id, { successCount: 0, failCount: 0, status: "failed" });
    return { ok: false as const, error: subs.error, successCount: 0, failCount: 0 };
  }

  const url = `${getPublicSiteUrl()}${pushMessagePath(message.synagogueId, message.id)}`;
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url,
    messageId: message.id,
    synagogueId: message.synagogueId
  });

  let successCount = 0;
  let failCount = 0;

  for (const sub of subs.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        },
        payload,
        { TTL: 60 * 60 * 12, urgency: "normal" }
      );
      successCount += 1;
    } catch (error) {
      failCount += 1;
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        await deleteDeadPushSubscription(sub.endpoint);
      }
    }
  }

  await finalizePushMessage(message.id, { successCount, failCount });
  return { ok: true as const, successCount, failCount, recipientCount: subs.rows.length };
}
