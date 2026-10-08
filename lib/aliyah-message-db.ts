import { getSupabaseAdminClient } from "@/lib/supabase-server";
import type { AliyahMessaging } from "@/lib/aliyah-types";
import { isIsoDate } from "@/lib/hebrew-civil-date";

function missingMessagingSchema(message: string) {
  return (
    /donation_url|aliyah_message_template|aliyah_message_log|messages_consent/i.test(message) &&
    /does not exist|schema cache|could not find/i.test(message)
  );
}

export async function loadAliyahMessaging(
  synagogueId: string,
  minyanId: string,
  serviceDate: string
): Promise<AliyahMessaging> {
  const empty: AliyahMessaging = { ready: false, synagogueName: "", donationUrl: "", template: "", sentAt: {} };
  const supabase = getSupabaseAdminClient();
  if (!supabase) return empty;

  const synagogueRes = await supabase
    .from("synagogues")
    .select("name, donation_url, aliyah_message_template")
    .eq("id", synagogueId)
    .maybeSingle();
  if (synagogueRes.error || !synagogueRes.data) {
    const nameRes = await supabase.from("synagogues").select("name").eq("id", synagogueId).maybeSingle();
    return { ...empty, synagogueName: String(nameRes.data?.name ?? "") };
  }
  const row = synagogueRes.data as { name?: string | null; donation_url?: string | null; aliyah_message_template?: string | null };

  let minyanDonationUrl = "";
  if (minyanId) {
    const minyanRes = await supabase
      .from("minyanim")
      .select("donation_url")
      .eq("id", minyanId)
      .eq("synagogue_id", synagogueId)
      .maybeSingle();
    if (!minyanRes.error && typeof minyanRes.data?.donation_url === "string") {
      minyanDonationUrl = minyanRes.data.donation_url.trim();
    }
  }

  const sentAt: Record<string, string> = {};
  if (minyanId && isIsoDate(serviceDate)) {
    const logRes = await supabase
      .from("aliyah_message_log")
      .select("congregant_id, opened_at")
      .eq("synagogue_id", synagogueId)
      .eq("minyan_id", minyanId)
      .eq("service_date", serviceDate)
      .order("opened_at", { ascending: true });
    if (logRes.error) {
      return { ...empty, synagogueName: String(row.name ?? "") };
    }
    for (const item of logRes.data ?? []) {
      if (item.congregant_id) sentAt[String(item.congregant_id)] = String(item.opened_at);
    }
  }

  return {
    ready: true,
    synagogueName: String(row.name ?? ""),
    donationUrl: minyanDonationUrl || (row.donation_url ?? ""),
    template: row.aliyah_message_template ?? "",
    sentAt
  };
}

export async function logAliyahMessage(params: {
  synagogueId: string;
  minyanId: string;
  serviceDate: string;
  congregantId: string;
  openedBy: string | null;
}): Promise<{ openedAt?: string; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "missing_service_role_key" };
  if (!isIsoDate(params.serviceDate)) return { error: "invalid_date" };

  const minyanRes = await supabase
    .from("minyanim")
    .select("id")
    .eq("id", params.minyanId)
    .eq("synagogue_id", params.synagogueId)
    .maybeSingle();
  if (minyanRes.error) return { error: minyanRes.error.message };
  if (!minyanRes.data) return { error: "invalid_minyan" };

  const congregantRes = await supabase
    .from("congregants")
    .select("id, messages_consent")
    .eq("id", params.congregantId)
    .eq("synagogue_id", params.synagogueId)
    .maybeSingle();
  if (congregantRes.error) {
    return { error: missingMessagingSchema(congregantRes.error.message) ? "missing_messaging_schema" : congregantRes.error.message };
  }
  if (!congregantRes.data) return { error: "invalid_congregant" };
  if (!congregantRes.data.messages_consent) return { error: "no_consent" };

  const inserted = await supabase
    .from("aliyah_message_log")
    .insert({
      synagogue_id: params.synagogueId,
      minyan_id: params.minyanId,
      service_date: params.serviceDate,
      congregant_id: params.congregantId,
      channel: "whatsapp_manual",
      opened_by: params.openedBy
    })
    .select("opened_at")
    .single();
  if (inserted.error) {
    return { error: missingMessagingSchema(inserted.error.message) ? "missing_messaging_schema" : inserted.error.message };
  }
  return { openedAt: String(inserted.data.opened_at) };
}
