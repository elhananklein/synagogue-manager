import { getSupabaseAdminClient } from "@/lib/supabase-server";
import type { PushMessageRecord, PushMessageStatus, PushSubscriptionRecord } from "@/lib/push-types";

type SubRow = {
  id: string;
  synagogue_id: string;
  minyan_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
};

type MsgRow = {
  id: string;
  synagogue_id: string;
  minyan_id: string | null;
  title: string;
  body: string;
  template_key: string | null;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  created_by: string | null;
  success_count: number;
  fail_count: number;
  created_at: string;
};

function rowToSub(row: SubRow): PushSubscriptionRecord {
  return {
    id: row.id,
    synagogueId: row.synagogue_id,
    minyanId: row.minyan_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at
  };
}

function rowToMsg(row: MsgRow): PushMessageRecord {
  return {
    id: row.id,
    synagogueId: row.synagogue_id,
    minyanId: row.minyan_id,
    title: row.title,
    body: row.body,
    templateKey: row.template_key,
    status: row.status as PushMessageStatus,
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
    createdBy: row.created_by,
    successCount: Number(row.success_count) || 0,
    failCount: Number(row.fail_count) || 0,
    createdAt: row.created_at
  };
}

export function missingPushTables(message: string) {
  return /push_subscriptions|push_messages/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

export async function upsertPushSubscription(input: {
  synagogueId: string;
  minyanId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { row: null as PushSubscriptionRecord | null, error: "missing_service_role_key" };
  const now = new Date().toISOString();
  const res = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        synagogue_id: input.synagogueId,
        minyan_id: input.minyanId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent,
        last_seen_at: now
      },
      { onConflict: "endpoint" }
    )
    .select("*")
    .single();
  if (res.error) {
    if (missingPushTables(res.error.message)) return { row: null, error: "missing_push_tables" };
    return { row: null, error: res.error.message };
  }
  return { row: rowToSub(res.data as SubRow) };
}

export async function deletePushSubscriptionByEndpoint(endpoint: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "missing_service_role_key" };
  const res = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (res.error) {
    if (missingPushTables(res.error.message)) return { error: "missing_push_tables" };
    return { error: res.error.message };
  }
  return {};
}

export async function countPushSubscriptions(synagogueId: string, minyanId: string | null = null) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { count: 0, error: "missing_service_role_key" };
  let query = supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("synagogue_id", synagogueId);
  if (minyanId) {
    query = query.or(`minyan_id.eq.${minyanId},minyan_id.is.null`);
  }
  const res = await query;
  if (res.error) {
    if (missingPushTables(res.error.message)) return { count: 0, error: "missing_push_tables" };
    return { count: 0, error: res.error.message };
  }
  return { count: res.count ?? 0 };
}

export async function listPushSubscriptionsForSend(synagogueId: string, minyanId: string | null) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: [] as PushSubscriptionRecord[], error: "missing_service_role_key" };
  let query = supabase.from("push_subscriptions").select("*").eq("synagogue_id", synagogueId);
  if (minyanId) {
    query = query.or(`minyan_id.eq.${minyanId},minyan_id.is.null`);
  }
  const res = await query;
  if (res.error) {
    if (missingPushTables(res.error.message)) return { rows: [], error: "missing_push_tables" };
    return { rows: [], error: res.error.message };
  }
  return { rows: ((res.data ?? []) as SubRow[]).map(rowToSub) };
}

export async function insertPushMessage(input: {
  synagogueId: string;
  minyanId: string | null;
  title: string;
  body: string;
  templateKey: string | null;
  status: PushMessageStatus;
  scheduledFor: string | null;
  createdBy: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { row: null as PushMessageRecord | null, error: "missing_service_role_key" };
  const res = await supabase
    .from("push_messages")
    .insert({
      synagogue_id: input.synagogueId,
      minyan_id: input.minyanId,
      title: input.title,
      body: input.body,
      template_key: input.templateKey,
      status: input.status,
      scheduled_for: input.scheduledFor,
      created_by: input.createdBy
    })
    .select("*")
    .single();
  if (res.error) {
    if (missingPushTables(res.error.message)) return { row: null, error: "missing_push_tables" };
    return { row: null, error: res.error.message };
  }
  return { row: rowToMsg(res.data as MsgRow) };
}

export async function getPushMessage(synagogueId: string, messageId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { row: null as PushMessageRecord | null, error: "missing_service_role_key" };
  const res = await supabase
    .from("push_messages")
    .select("*")
    .eq("synagogue_id", synagogueId)
    .eq("id", messageId)
    .maybeSingle();
  if (res.error) {
    if (missingPushTables(res.error.message)) return { row: null, error: "missing_push_tables" };
    return { row: null, error: res.error.message };
  }
  if (!res.data) return { row: null, error: "not_found" };
  return { row: rowToMsg(res.data as MsgRow) };
}

export async function listPushMessages(synagogueId: string, limit = 30) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: [] as PushMessageRecord[], error: "missing_service_role_key" };
  const res = await supabase
    .from("push_messages")
    .select("*")
    .eq("synagogue_id", synagogueId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (res.error) {
    if (missingPushTables(res.error.message)) return { rows: [], error: "missing_push_tables" };
    return { rows: [], error: res.error.message };
  }
  return { rows: ((res.data ?? []) as MsgRow[]).map(rowToMsg) };
}

export async function listDuePushMessages(limit = 40) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: [] as PushMessageRecord[], error: "missing_service_role_key" };
  const now = new Date().toISOString();
  const res = await supabase
    .from("push_messages")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (res.error) {
    if (missingPushTables(res.error.message)) return { rows: [], error: "missing_push_tables" };
    return { rows: [], error: res.error.message };
  }
  return { rows: ((res.data ?? []) as MsgRow[]).map(rowToMsg) };
}

export async function markPushMessageSending(messageId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "missing_service_role_key" };
  const res = await supabase
    .from("push_messages")
    .update({ status: "sending" })
    .eq("id", messageId)
    .eq("status", "scheduled")
    .select("id");
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: (res.data?.length ?? 0) > 0 };
}

export async function finalizePushMessage(
  messageId: string,
  result: { successCount: number; failCount: number; status?: "sent" | "failed" }
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "missing_service_role_key" };
  const status = result.status ?? (result.successCount > 0 ? "sent" : "failed");
  const res = await supabase
    .from("push_messages")
    .update({
      status,
      sent_at: new Date().toISOString(),
      success_count: result.successCount,
      fail_count: result.failCount
    })
    .eq("id", messageId);
  if (res.error) return { error: res.error.message };
  return {};
}

export async function cancelPushMessage(synagogueId: string, messageId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { row: null as PushMessageRecord | null, error: "missing_service_role_key" };
  const res = await supabase
    .from("push_messages")
    .update({ status: "cancelled" })
    .eq("synagogue_id", synagogueId)
    .eq("id", messageId)
    .eq("status", "scheduled")
    .select("*")
    .maybeSingle();
  if (res.error) return { row: null, error: res.error.message };
  if (!res.data) return { row: null, error: "not_found" };
  return { row: rowToMsg(res.data as MsgRow) };
}

export async function deleteDeadPushSubscription(endpoint: string) {
  return deletePushSubscriptionByEndpoint(endpoint);
}
