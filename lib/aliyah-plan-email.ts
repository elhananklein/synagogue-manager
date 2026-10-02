import { getSupabaseAdminClient } from "@/lib/supabase-server";
import {
  getAliyahPlan,
  listSynagogueGabbaiEmails,
  markAliyahPlanEmailed,
  parseEmailRecipients,
  planPeopleById,
  type AliyahPlanContext
} from "@/lib/aliyah-plan-db";
import { renderAliyahPlanBody, renderAliyahPlanDocument, renderAliyahPlanText } from "@/lib/aliyah-plan-html";
import type { AliyahPlanSettings } from "@/lib/aliyah-plan-types";
import { sendSiteMail } from "@/lib/mailer";
import { getPublicSiteUrl } from "@/lib/site-url";

export async function loadSynagogueAndMinyanNames(synagogueId: string, minyanId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { synagogueName: "", minyanName: "" };
  const [synagogue, minyan] = await Promise.all([
    supabase.from("synagogues").select("name").eq("id", synagogueId).maybeSingle(),
    supabase.from("minyanim").select("name").eq("id", minyanId).maybeSingle()
  ]);
  return {
    synagogueName: String(synagogue.data?.name ?? ""),
    minyanName: String(minyan.data?.name ?? "")
  };
}

/** HTML מלא של דף התכנון — להדפסה או למייל. */
export async function buildAliyahPlanDocument(
  synagogueId: string,
  minyanId: string,
  serviceDate: string,
  options?: { forPrint?: boolean; context?: AliyahPlanContext }
) {
  const [res, names] = await Promise.all([
    getAliyahPlan(synagogueId, minyanId, serviceDate, { context: options?.context }),
    loadSynagogueAndMinyanNames(synagogueId, minyanId)
  ]);
  if (!res.plan || !res.context) return { error: res.error ?? "plan_failed" } as const;
  const site = getPublicSiteUrl();
  const input = {
    plan: res.plan,
    synagogueName: names.synagogueName,
    minyanName: names.minyanName,
    people: planPeopleById(res.context.congregants),
    plannerUrl: site
      ? `${site}/admin/gabbai/${encodeURIComponent(synagogueId)}/aliyot/plan?minyan=${encodeURIComponent(minyanId)}&date=${serviceDate}`
      : undefined,
    forPrint: options?.forPrint
  };
  return {
    plan: res.plan,
    settings: res.settings as AliyahPlanSettings,
    context: res.context,
    names,
    document: renderAliyahPlanDocument(input),
    body: renderAliyahPlanBody(input),
    text: renderAliyahPlanText(input)
  } as const;
}

export async function sendAliyahPlanEmail(
  synagogueId: string,
  minyanId: string,
  serviceDates: string[],
  options?: { context?: AliyahPlanContext; requireEnabled?: boolean }
): Promise<{ ok: boolean; error?: string; recipients?: string[] }> {
  if (!serviceDates.length) return { ok: false, error: "no_dates" };
  const built = [];
  for (const date of serviceDates) {
    const doc = await buildAliyahPlanDocument(synagogueId, minyanId, date, { context: options?.context });
    if ("error" in doc) return { ok: false, error: doc.error };
    built.push(doc);
  }
  const first = built[0]!;
  if (options?.requireEnabled && !first.settings.emailEnabled) return { ok: false, error: "email_disabled" };

  const configured = parseEmailRecipients(first.settings.emailRecipients);
  const recipients = configured.length ? configured : await listSynagogueGabbaiEmails(synagogueId);
  if (!recipients.length) return { ok: false, error: "no_recipients" };

  const titles = built.map((doc) => doc.plan.title).filter(Boolean);
  const subject = `עולים לתורה — ${titles.join(" / ")}${first.names.minyanName ? ` · ${first.names.minyanName}` : ""}`;
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;background:#fff">${built
    .map((doc) => doc.body)
    .join('<hr style="margin:28px 0;border:none;border-top:2px dashed #c9d2d6">')}</body></html>`;
  const text = built.map((doc) => doc.text).join("\n\n-----\n\n");

  const sent = await sendSiteMail({ to: recipients, subject, html, text });
  if (!sent.ok) return { ok: false, error: sent.error };
  for (const date of serviceDates) await markAliyahPlanEmailed(synagogueId, minyanId, date);
  return { ok: true, recipients };
}
