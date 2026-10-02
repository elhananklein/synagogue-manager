import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { addDaysIso, aliyahDayMeta, extraAliyahSlot, isAliyahSlotKey, parseExtraSlotKey } from "@/lib/aliyah-slots";
import { recommendAliyahPlan, type RecommendHistoryRow, type RecommendPerson, type RecommendRelation } from "@/lib/aliyah-recommend";
import {
  isManualChiyuvKind,
  normalizeAliyahPlanSettings,
  type AliyahPlan,
  type AliyahPlanCandidate,
  type AliyahPlanSettings,
  type AliyahPlanSlot,
  type AliyahPlanSlotInput,
  type ManualChiyuvEvent,
  type ManualChiyuvKind
} from "@/lib/aliyah-plan-types";
import { listCongregants } from "@/lib/congregant-db";
import {
  congregantDisplayName,
  congregantPrayerName,
  isFamilyRelation,
  isYahrzeitRelation,
  type CongregantRecord,
  type CongregantYahrzeit
} from "@/lib/congregant-types";
import { isIsoDate, isValidHebrewDate } from "@/lib/hebrew-civil-date";

const HISTORY_DAYS = 730;

type Admin = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

export function missingAliyahPlanTable(message: string) {
  return (
    /minyan_aliyah_settings|aliyah_chiyuv_events|aliyah_plans|aliyah_plan_slots/i.test(message) &&
    /does not exist|schema cache|could not find/i.test(message)
  );
}

function planError(message: string) {
  return missingAliyahPlanTable(message) ? "missing_aliyah_plan_table" : message;
}

async function minyanBelongs(supabase: Admin, synagogueId: string, minyanId: string) {
  const res = await supabase.from("minyanim").select("id").eq("id", minyanId).eq("synagogue_id", synagogueId).maybeSingle();
  return !res.error && Boolean(res.data);
}

type SettingsRow = {
  yahrzeit_timing: string;
  yahrzeit_scope: string;
  maftir_for_yahrzeit: boolean;
  maftir_for_bar_mitzvah: boolean;
  separate_relatives: boolean;
  extra_aliyot_for_chiyuvim: boolean;
  backups_count: number;
  min_weeks_between: number;
  priority_order: string[] | null;
  email_enabled: boolean;
  email_recipients: string | null;
};

function settingsFromRow(row: SettingsRow | null): AliyahPlanSettings {
  if (!row) return normalizeAliyahPlanSettings(null);
  return normalizeAliyahPlanSettings({
    yahrzeitTiming: row.yahrzeit_timing === "shabbat_of_week" ? "shabbat_of_week" : "shabbat_before",
    yahrzeitScope: row.yahrzeit_scope === "parents" ? "parents" : "all",
    maftirForYahrzeit: row.maftir_for_yahrzeit,
    maftirForBarMitzvah: row.maftir_for_bar_mitzvah,
    separateRelatives: row.separate_relatives,
    extraAliyotForChiyuvim: row.extra_aliyot_for_chiyuvim,
    backupsCount: row.backups_count,
    minWeeksBetween: row.min_weeks_between,
    priorityOrder: (row.priority_order ?? []) as AliyahPlanSettings["priorityOrder"],
    emailEnabled: row.email_enabled,
    emailRecipients: row.email_recipients ?? ""
  });
}

export async function loadAliyahPlanSettings(
  minyanId: string
): Promise<{ settings: AliyahPlanSettings; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { settings: normalizeAliyahPlanSettings(null), error: "missing_service_role_key" };
  const res = await supabase
    .from("minyan_aliyah_settings")
    .select(
      "yahrzeit_timing, yahrzeit_scope, maftir_for_yahrzeit, maftir_for_bar_mitzvah, separate_relatives, extra_aliyot_for_chiyuvim, backups_count, min_weeks_between, priority_order, email_enabled, email_recipients"
    )
    .eq("minyan_id", minyanId)
    .maybeSingle();
  if (res.error) return { settings: normalizeAliyahPlanSettings(null), error: planError(res.error.message) };
  return { settings: settingsFromRow(res.data as SettingsRow | null) };
}

export async function saveAliyahPlanSettings(
  synagogueId: string,
  minyanId: string,
  raw: Partial<AliyahPlanSettings>
): Promise<{ settings: AliyahPlanSettings | null; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { settings: null, error: "missing_service_role_key" };
  if (!(await minyanBelongs(supabase, synagogueId, minyanId))) return { settings: null, error: "invalid_minyan" };
  const settings = normalizeAliyahPlanSettings(raw);
  const res = await supabase.from("minyan_aliyah_settings").upsert(
    {
      minyan_id: minyanId,
      synagogue_id: synagogueId,
      yahrzeit_timing: settings.yahrzeitTiming,
      yahrzeit_scope: settings.yahrzeitScope,
      maftir_for_yahrzeit: settings.maftirForYahrzeit,
      maftir_for_bar_mitzvah: settings.maftirForBarMitzvah,
      separate_relatives: settings.separateRelatives,
      extra_aliyot_for_chiyuvim: settings.extraAliyotForChiyuvim,
      backups_count: settings.backupsCount,
      min_weeks_between: settings.minWeeksBetween,
      priority_order: settings.priorityOrder,
      email_enabled: settings.emailEnabled,
      email_recipients: settings.emailRecipients || null
    },
    { onConflict: "minyan_id" }
  );
  if (res.error) return { settings: null, error: planError(res.error.message) };
  return { settings };
}

type EventRow = {
  id: string;
  congregant_id: string;
  service_date: string;
  kind: string;
  preferred_slot: string | null;
  notes: string | null;
};

function eventFromRow(row: EventRow): ManualChiyuvEvent | null {
  if (!isManualChiyuvKind(row.kind)) return null;
  return {
    id: String(row.id),
    congregantId: String(row.congregant_id),
    serviceDate: String(row.service_date).slice(0, 10),
    kind: row.kind,
    preferredSlot: row.preferred_slot,
    notes: row.notes ?? ""
  };
}

export async function listChiyuvEvents(
  synagogueId: string,
  minyanId: string,
  serviceDate: string
): Promise<{ events: ManualChiyuvEvent[]; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { events: [], error: "missing_service_role_key" };
  const res = await supabase
    .from("aliyah_chiyuv_events")
    .select("id, congregant_id, service_date, kind, preferred_slot, notes")
    .eq("synagogue_id", synagogueId)
    .eq("minyan_id", minyanId)
    .eq("service_date", serviceDate)
    .order("created_at", { ascending: true });
  if (res.error) return { events: [], error: planError(res.error.message) };
  return {
    events: ((res.data ?? []) as EventRow[]).map(eventFromRow).filter((item): item is ManualChiyuvEvent => Boolean(item))
  };
}

export async function addChiyuvEvent(
  synagogueId: string,
  minyanId: string,
  input: { congregantId: string; serviceDate: string; kind: ManualChiyuvKind; preferredSlot: string | null; notes: string }
): Promise<{ event: ManualChiyuvEvent | null; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { event: null, error: "missing_service_role_key" };
  if (!isIsoDate(input.serviceDate)) return { event: null, error: "invalid_date" };
  if (input.preferredSlot && !isAliyahSlotKey(input.preferredSlot)) return { event: null, error: "invalid_slot" };
  if (!(await minyanBelongs(supabase, synagogueId, minyanId))) return { event: null, error: "invalid_minyan" };
  const person = await supabase
    .from("congregants")
    .select("id")
    .eq("synagogue_id", synagogueId)
    .eq("id", input.congregantId)
    .maybeSingle();
  if (person.error || !person.data) return { event: null, error: "invalid_congregant" };
  const res = await supabase
    .from("aliyah_chiyuv_events")
    .upsert(
      {
        synagogue_id: synagogueId,
        minyan_id: minyanId,
        congregant_id: input.congregantId,
        service_date: input.serviceDate,
        kind: input.kind,
        preferred_slot: input.preferredSlot,
        notes: input.notes.trim() || null
      },
      { onConflict: "minyan_id,service_date,congregant_id" }
    )
    .select("id, congregant_id, service_date, kind, preferred_slot, notes")
    .single();
  if (res.error) return { event: null, error: planError(res.error.message) };
  return { event: eventFromRow(res.data as EventRow) };
}

export async function deleteChiyuvEvent(synagogueId: string, eventId: string): Promise<{ error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "missing_service_role_key" };
  const res = await supabase.from("aliyah_chiyuv_events").delete().eq("synagogue_id", synagogueId).eq("id", eventId);
  if (res.error) return { error: planError(res.error.message) };
  return {};
}

type YahrzeitDbRow = {
  congregant_id: string;
  relation: string;
  person_name: string | null;
  gregorian_date: string | null;
  hebrew_year: number | null;
  hebrew_month: number | null;
  hebrew_day: number | null;
  after_sunset: boolean | null;
};

async function loadYahrzeitsBySynagogue(supabase: Admin, synagogueId: string) {
  const res = await supabase
    .from("congregant_yahrzeits")
    .select("congregant_id, relation, person_name, gregorian_date, hebrew_year, hebrew_month, hebrew_day, after_sunset")
    .eq("synagogue_id", synagogueId);
  const map = new Map<string, CongregantYahrzeit[]>();
  if (res.error) return map;
  for (const row of (res.data ?? []) as YahrzeitDbRow[]) {
    if (!isYahrzeitRelation(row.relation)) continue;
    const list = map.get(row.congregant_id) ?? [];
    list.push({
      id: "",
      relation: row.relation,
      personName: String(row.person_name ?? "").trim(),
      gregorianDate: row.gregorian_date ? String(row.gregorian_date).slice(0, 10) : "",
      hebrewYear: row.hebrew_year ?? 0,
      hebrewMonth: row.hebrew_month ?? 7,
      hebrewDay: row.hebrew_day ?? 1,
      afterSunset: Boolean(row.after_sunset)
    });
    map.set(row.congregant_id, list);
  }
  return map;
}

async function loadRelationsBySynagogue(supabase: Admin, synagogueId: string): Promise<RecommendRelation[]> {
  const res = await supabase
    .from("congregant_relations")
    .select("congregant_id, related_id, relation")
    .eq("synagogue_id", synagogueId);
  if (res.error) return [];
  return ((res.data ?? []) as Array<{ congregant_id: string; related_id: string; relation: string }>)
    .filter((row) => isFamilyRelation(row.relation))
    .map((row) => ({
      congregantId: String(row.congregant_id),
      relatedId: String(row.related_id),
      relation: row.relation as RecommendRelation["relation"]
    }));
}

async function loadAliyahHistory(supabase: Admin, synagogueId: string, beforeIso: string): Promise<RecommendHistoryRow[]> {
  const sessions = await supabase
    .from("aliyah_sessions")
    .select("id, service_date")
    .eq("synagogue_id", synagogueId)
    .gte("service_date", addDaysIso(beforeIso, -HISTORY_DAYS))
    .lt("service_date", beforeIso);
  if (sessions.error || !sessions.data?.length) return [];
  const dateBySession = new Map(sessions.data.map((row) => [String(row.id), String(row.service_date).slice(0, 10)]));
  const ids = [...dateBySession.keys()];
  const out: RecommendHistoryRow[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const res = await supabase.from("aliyah_assignments").select("session_id, congregant_id").in("session_id", chunk);
    if (res.error) continue;
    for (const row of res.data ?? []) {
      if (!row.congregant_id) continue;
      out.push({ serviceDate: dateBySession.get(String(row.session_id)) ?? "", congregantId: String(row.congregant_id) });
    }
  }
  return out;
}

function toRecommendPerson(row: CongregantRecord, yahrzeits: CongregantYahrzeit[] | undefined): RecommendPerson {
  const birth = { year: row.hebrewBirthYear, month: row.hebrewBirthMonth, day: row.hebrewBirthDay };
  return {
    id: row.id,
    displayName: congregantDisplayName(row),
    tribe: row.tribe,
    gender: row.gender,
    minyanId: row.minyanId,
    isActive: row.isActive,
    receivesAliyah: row.receivesAliyah,
    approved: row.registrationStatus !== "pending",
    hebrewBirth: isValidHebrewDate(birth) ? birth : null,
    yahrzeits: yahrzeits?.length ? yahrzeits : row.yahrzeits
  };
}

export type AliyahPlanPerson = { id: string; displayName: string; prayerName: string };

export type AliyahPlanContext = {
  congregants: CongregantRecord[];
  people: RecommendPerson[];
  relations: RecommendRelation[];
  history: RecommendHistoryRow[];
};

export async function loadAliyahPlanContext(
  synagogueId: string,
  serviceDate: string
): Promise<{ context: AliyahPlanContext | null; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { context: null, error: "missing_service_role_key" };
  const [congregants, yahrzeits, relations, history] = await Promise.all([
    listCongregants(synagogueId),
    loadYahrzeitsBySynagogue(supabase, synagogueId),
    loadRelationsBySynagogue(supabase, synagogueId),
    loadAliyahHistory(supabase, synagogueId, serviceDate)
  ]);
  if (congregants.error) return { context: null, error: congregants.error };
  return {
    context: {
      congregants: congregants.rows,
      people: congregants.rows.map((row) => toRecommendPerson(row, yahrzeits.get(row.id))),
      relations,
      history
    }
  };
}

type PlanSlotRow = {
  slot_key: string;
  sort_order: number;
  rank: number;
  congregant_id: string | null;
  reason: string | null;
  locked: boolean;
};

function savedSlotsToPlanSlots(serviceDate: string, rows: PlanSlotRow[]): AliyahPlanSlot[] {
  const base = aliyahDayMeta(serviceDate).slots;
  const byKey = new Map<string, PlanSlotRow[]>();
  for (const row of rows) {
    const list = byKey.get(row.slot_key) ?? [];
    list.push(row);
    byKey.set(row.slot_key, list);
  }
  const toCandidate = (row: PlanSlotRow | undefined): AliyahPlanCandidate | null =>
    row?.congregant_id ? { congregantId: row.congregant_id, reason: row.reason ?? "", chiyuv: null } : null;
  const build = (def: { key: string; label: string; expectedTribe: AliyahPlanSlot["expectedTribe"]; extra?: boolean }): AliyahPlanSlot => {
    const list = (byKey.get(def.key) ?? []).sort((a, b) => a.rank - b.rank);
    const primaryRow = list.find((row) => row.rank === 0);
    return {
      key: def.key,
      label: def.label,
      expectedTribe: def.expectedTribe,
      extra: def.extra,
      primary: toCandidate(primaryRow),
      backups: list
        .filter((row) => row.rank > 0)
        .map(toCandidate)
        .filter((item): item is AliyahPlanCandidate => Boolean(item)),
      locked: Boolean(primaryRow?.locked),
      note: null
    };
  };
  const slots = base.map(build);
  const extras = [...byKey.keys()]
    .map((key) => parseExtraSlotKey(key))
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b)
    .map((n) => build(extraAliyahSlot(n)));
  return [...slots, ...extras];
}

/** תכנון שמור אם יש, אחרת חישוב טרי. בתכנון שמור — השכבות וחיובים שלא שובצו מחושבים מחדש. */
export async function getAliyahPlan(
  synagogueId: string,
  minyanId: string,
  serviceDate: string,
  options?: { locked?: Record<string, string>; ignoreSaved?: boolean; context?: AliyahPlanContext; settings?: AliyahPlanSettings }
): Promise<{ plan: AliyahPlan | null; context?: AliyahPlanContext; settings?: AliyahPlanSettings; events?: ManualChiyuvEvent[]; error?: string }> {
  if (!isIsoDate(serviceDate)) return { plan: null, error: "invalid_date" };
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { plan: null, error: "missing_service_role_key" };
  if (!(await minyanBelongs(supabase, synagogueId, minyanId))) return { plan: null, error: "invalid_minyan" };

  const [settingsRes, eventsRes, contextRes] = await Promise.all([
    options?.settings ? Promise.resolve({ settings: options.settings }) : loadAliyahPlanSettings(minyanId),
    listChiyuvEvents(synagogueId, minyanId, serviceDate),
    options?.context ? Promise.resolve({ context: options.context }) : loadAliyahPlanContext(synagogueId, serviceDate)
  ]);
  const context = contextRes.context;
  if (!context) return { plan: null, error: "error" in contextRes ? contextRes.error : "error" };
  const settings = settingsRes.settings;
  const settingsError = "error" in settingsRes && typeof settingsRes.error === "string" ? settingsRes.error : undefined;
  const tableError = settingsError || eventsRes.error;

  const computed = recommendAliyahPlan({
    minyanId,
    serviceDate,
    settings,
    people: context.people,
    relations: context.relations,
    history: context.history,
    events: eventsRes.events,
    locked: options?.locked
  });

  if (options?.ignoreSaved || tableError === "missing_aliyah_plan_table") {
    return { plan: computed, context, settings, events: eventsRes.events, error: tableError || undefined };
  }

  const planRes = await supabase
    .from("aliyah_plans")
    .select("id, updated_at, emailed_at")
    .eq("synagogue_id", synagogueId)
    .eq("minyan_id", minyanId)
    .eq("service_date", serviceDate)
    .maybeSingle();
  if (planRes.error) {
    return { plan: computed, context, settings, events: eventsRes.events, error: planError(planRes.error.message) };
  }
  if (!planRes.data) return { plan: computed, context, settings, events: eventsRes.events };

  const slotsRes = await supabase
    .from("aliyah_plan_slots")
    .select("slot_key, sort_order, rank, congregant_id, reason, locked")
    .eq("plan_id", planRes.data.id)
    .order("sort_order", { ascending: true });
  if (slotsRes.error) {
    return { plan: computed, context, settings, events: eventsRes.events, error: planError(slotsRes.error.message) };
  }
  const chiyuvById = new Map<string, AliyahPlanCandidate["chiyuv"]>();
  for (const slot of computed.slots) {
    for (const item of [slot.primary, ...slot.backups]) if (item?.chiyuv) chiyuvById.set(item.congregantId, item.chiyuv);
  }
  for (const item of computed.unplaced) chiyuvById.set(item.congregantId, item.kind);
  const slots = savedSlotsToPlanSlots(serviceDate, (slotsRes.data ?? []) as PlanSlotRow[]).map((slot) => {
    const withKind = (item: AliyahPlanCandidate) => ({ ...item, chiyuv: chiyuvById.get(item.congregantId) ?? null });
    return { ...slot, primary: slot.primary ? withKind(slot.primary) : null, backups: slot.backups.map(withKind) };
  });
  const placed = new Set(slots.flatMap((slot) => (slot.primary ? [slot.primary.congregantId] : [])));
  return {
    plan: {
      ...computed,
      slots,
      unplaced: computed.unplaced.filter((item) => !placed.has(item.congregantId)),
      saved: true,
      savedAt: planRes.data.updated_at ? String(planRes.data.updated_at) : null,
      emailedAt: planRes.data.emailed_at ? String(planRes.data.emailed_at) : null
    },
    context,
    settings,
    events: eventsRes.events
  };
}

export async function saveAliyahPlan(
  synagogueId: string,
  minyanId: string,
  serviceDate: string,
  slots: AliyahPlanSlotInput[]
): Promise<{ error?: string }> {
  if (!isIsoDate(serviceDate)) return { error: "invalid_date" };
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "missing_service_role_key" };
  if (!(await minyanBelongs(supabase, synagogueId, minyanId))) return { error: "invalid_minyan" };
  for (const slot of slots) if (!isAliyahSlotKey(slot.slotKey)) return { error: "invalid_slot" };

  const ids = [
    ...new Set(slots.flatMap((slot) => slot.candidates.map((item) => item.congregantId)).filter((id): id is string => Boolean(id)))
  ];
  if (ids.length) {
    const check = await supabase.from("congregants").select("id").eq("synagogue_id", synagogueId).in("id", ids);
    if (check.error) return { error: check.error.message };
    if ((check.data ?? []).length !== ids.length) return { error: "invalid_congregant" };
  }

  const planRes = await supabase
    .from("aliyah_plans")
    .upsert({ synagogue_id: synagogueId, minyan_id: minyanId, service_date: serviceDate }, { onConflict: "minyan_id,service_date" })
    .select("id")
    .single();
  if (planRes.error) return { error: planError(planRes.error.message) };
  const planId = String(planRes.data.id);

  const del = await supabase.from("aliyah_plan_slots").delete().eq("plan_id", planId);
  if (del.error) return { error: planError(del.error.message) };

  const rows = slots.flatMap((slot) =>
    slot.candidates.slice(0, 4).flatMap((item, rank) =>
      item.congregantId || rank === 0
        ? [
            {
              plan_id: planId,
              slot_key: slot.slotKey,
              sort_order: slot.sortOrder,
              rank,
              congregant_id: item.congregantId,
              reason: item.reason.trim().slice(0, 300) || null,
              locked: rank === 0 ? slot.locked : false
            }
          ]
        : []
    )
  );
  if (rows.length) {
    const ins = await supabase.from("aliyah_plan_slots").insert(rows);
    if (ins.error) return { error: planError(ins.error.message) };
  }
  return {};
}

/** המומלצים מתכנון שמור — למילוי מהיר של הרישום אחרי השבת. */
export async function loadSavedPlanPrimaries(
  synagogueId: string,
  minyanId: string,
  serviceDate: string
): Promise<Array<{ slotKey: string; sortOrder: number; congregantId: string }> | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const planRes = await supabase
    .from("aliyah_plans")
    .select("id")
    .eq("synagogue_id", synagogueId)
    .eq("minyan_id", minyanId)
    .eq("service_date", serviceDate)
    .maybeSingle();
  if (planRes.error || !planRes.data) return null;
  const slotsRes = await supabase
    .from("aliyah_plan_slots")
    .select("slot_key, sort_order, congregant_id")
    .eq("plan_id", planRes.data.id)
    .eq("rank", 0)
    .order("sort_order", { ascending: true });
  if (slotsRes.error) return null;
  const rows = (slotsRes.data ?? [])
    .filter((row) => row.congregant_id)
    .map((row) => ({ slotKey: String(row.slot_key), sortOrder: Number(row.sort_order), congregantId: String(row.congregant_id) }));
  return rows.length ? rows : null;
}

export async function markAliyahPlanEmailed(synagogueId: string, minyanId: string, serviceDate: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  const now = new Date().toISOString();
  const existing = await supabase
    .from("aliyah_plans")
    .update({ emailed_at: now })
    .eq("synagogue_id", synagogueId)
    .eq("minyan_id", minyanId)
    .eq("service_date", serviceDate)
    .select("id");
  if (!existing.error && (existing.data ?? []).length) return;
  await supabase
    .from("aliyah_plans")
    .upsert(
      { synagogue_id: synagogueId, minyan_id: minyanId, service_date: serviceDate, emailed_at: now },
      { onConflict: "minyan_id,service_date" }
    );
}

export function planPeopleById(congregants: CongregantRecord[]): Map<string, AliyahPlanPerson> {
  return new Map(
    congregants.map((row) => [row.id, { id: row.id, displayName: congregantDisplayName(row), prayerName: congregantPrayerName(row) }])
  );
}

/** כתובות המייל של הגבאים המשויכים לבית הכנסת. */
export async function listSynagogueGabbaiEmails(synagogueId: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const links = await supabase.from("synagogue_admins").select("user_id").eq("synagogue_id", synagogueId);
  if (links.error || !links.data?.length) return [];
  const emails: string[] = [];
  for (const link of links.data) {
    const user = await supabase.auth.admin.getUserById(String(link.user_id));
    const email = user.data.user?.email;
    if (email) emails.push(email);
  }
  return [...new Set(emails)];
}

export function parseEmailRecipients(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
    )
  ];
}
