import { getSupabaseAdminClient } from "@/lib/supabase-server";
import {
  aliyahDayMeta,
  extraAliyahSlot,
  isAliyahSlotKey,
  mergeAliyahSlots,
  parseExtraSlotKey
} from "@/lib/aliyah-slots";
import { ALIYAH_SERVICE_KEY, toAliyahCongregantOption, type AliyahAssignmentInput, type AliyahNoKohenResolution, type AliyahSheet, type AliyahSlotState } from "@/lib/aliyah-types";
import { listCongregants, listSynagogueMinyanOptions } from "@/lib/congregant-db";
import { isIsoDate } from "@/lib/hebrew-civil-date";

type SessionRow = {
  id: string;
  synagogue_id: string;
  minyan_id: string;
  service_date: string;
  service_key: string;
  parasha_label: string | null;
  hebrew_date_label: string | null;
  notes: string | null;
};

type AssignmentRow = {
  slot_key: string;
  sort_order: number;
  congregant_id: string | null;
  no_kohen_resolution: string | null;
  notes: string | null;
};

function missingAliyotTable(message: string) {
  return /aliyah_sessions|aliyah_assignments/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

function parseNoKohen(value: string | null | undefined): AliyahNoKohenResolution | null {
  return value === "yisrael" || value === "skip" ? value : null;
}

function assignmentToSlot(row: AssignmentRow): AliyahSlotState {
  const extraIndex = parseExtraSlotKey(row.slot_key);
  const def =
    extraIndex != null
      ? extraAliyahSlot(extraIndex)
      : { key: row.slot_key, label: row.slot_key, expectedTribe: null as AliyahSlotState["expectedTribe"] };
  return {
    ...def,
    congregantId: row.congregant_id,
    noKohenResolution: parseNoKohen(row.no_kohen_resolution),
    notes: row.notes ?? ""
  };
}

export async function loadAliyahSheet(
  synagogueId: string,
  minyanId: string,
  serviceDate: string
): Promise<{ sheet: AliyahSheet | null; error?: string }> {
  if (!isIsoDate(serviceDate)) return { sheet: null, error: "invalid_date" };
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { sheet: null, error: "missing_service_role_key" };

  const minyanRes = await supabase
    .from("minyanim")
    .select("id")
    .eq("id", minyanId)
    .eq("synagogue_id", synagogueId)
    .maybeSingle();
  if (minyanRes.error) {
    return { sheet: null, error: missingAliyotTable(minyanRes.error.message) ? "missing_aliyot_table" : minyanRes.error.message };
  }
  if (!minyanRes.data) return { sheet: null, error: "invalid_minyan" };

  const meta = aliyahDayMeta(serviceDate);
  const sessionRes = await supabase
    .from("aliyah_sessions")
    .select("id, synagogue_id, minyan_id, service_date, service_key, parasha_label, hebrew_date_label, notes")
    .eq("synagogue_id", synagogueId)
    .eq("minyan_id", minyanId)
    .eq("service_date", serviceDate)
    .eq("service_key", ALIYAH_SERVICE_KEY)
    .maybeSingle();

  if (sessionRes.error) {
    return { sheet: null, error: missingAliyotTable(sessionRes.error.message) ? "missing_aliyot_table" : sessionRes.error.message };
  }

  let saved: AliyahSlotState[] = [];
  const session = sessionRes.data as SessionRow | null;
  if (session) {
    const assignmentRes = await supabase
      .from("aliyah_assignments")
      .select("slot_key, sort_order, congregant_id, no_kohen_resolution, notes")
      .eq("session_id", session.id)
      .order("sort_order", { ascending: true });
    if (assignmentRes.error) {
      return { sheet: null, error: missingAliyotTable(assignmentRes.error.message) ? "missing_aliyot_table" : assignmentRes.error.message };
    }
    saved = ((assignmentRes.data ?? []) as AssignmentRow[]).map(assignmentToSlot);
  }

  return {
    sheet: {
      minyanId,
      serviceDate,
      serviceKey: ALIYAH_SERVICE_KEY,
      hebrewDate: session?.hebrew_date_label || meta.hebrewDate,
      parashaLabel: session?.parasha_label || meta.parashaLabel,
      weekday: meta.weekday,
      kind: meta.kind,
      isKriahDay: meta.isKriahDay,
      slots: mergeAliyahSlots(meta.slots, saved)
    }
  };
}

export async function saveAliyahSheet(
  synagogueId: string,
  minyanId: string,
  serviceDate: string,
  assignments: AliyahAssignmentInput[]
): Promise<{ sheet: AliyahSheet | null; error?: string }> {
  if (!isIsoDate(serviceDate)) return { sheet: null, error: "invalid_date" };
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { sheet: null, error: "missing_service_role_key" };

  const minyanRes = await supabase
    .from("minyanim")
    .select("id")
    .eq("id", minyanId)
    .eq("synagogue_id", synagogueId)
    .maybeSingle();
  if (minyanRes.error) return { sheet: null, error: minyanRes.error.message };
  if (!minyanRes.data) return { sheet: null, error: "invalid_minyan" };

  for (const item of assignments) {
    if (!isAliyahSlotKey(item.slotKey)) return { sheet: null, error: "invalid_slot" };
  }

  const congregantIds = [...new Set(assignments.map((item) => item.congregantId).filter((id): id is string => Boolean(id)))];
  if (congregantIds.length) {
    const congregantsRes = await supabase
      .from("congregants")
      .select("id")
      .eq("synagogue_id", synagogueId)
      .in("id", congregantIds);
    if (congregantsRes.error) {
      return {
        sheet: null,
        error: /congregants/i.test(congregantsRes.error.message) ? "missing_congregants_table" : congregantsRes.error.message
      };
    }
    if ((congregantsRes.data ?? []).length !== congregantIds.length) {
      return { sheet: null, error: "invalid_congregant" };
    }
  }

  const meta = aliyahDayMeta(serviceDate);
  const sessionRes = await supabase
    .from("aliyah_sessions")
    .upsert(
      {
        synagogue_id: synagogueId,
        minyan_id: minyanId,
        service_date: serviceDate,
        service_key: ALIYAH_SERVICE_KEY,
        parasha_label: meta.parashaLabel || null,
        hebrew_date_label: meta.hebrewDate || null
      },
      { onConflict: "minyan_id,service_date,service_key" }
    )
    .select("id")
    .single();

  if (sessionRes.error) {
    return { sheet: null, error: missingAliyotTable(sessionRes.error.message) ? "missing_aliyot_table" : sessionRes.error.message };
  }

  const sessionId = String(sessionRes.data.id);
  const delRes = await supabase.from("aliyah_assignments").delete().eq("session_id", sessionId);
  if (delRes.error) {
    return { sheet: null, error: missingAliyotTable(delRes.error.message) ? "missing_aliyot_table" : delRes.error.message };
  }

  if (assignments.length) {
    const insertRes = await supabase.from("aliyah_assignments").insert(
      assignments.map((item) => ({
        session_id: sessionId,
        slot_key: item.slotKey,
        sort_order: item.sortOrder,
        congregant_id: item.congregantId,
        no_kohen_resolution: item.slotKey === "kohen" ? item.noKohenResolution : null,
        notes: item.notes.trim() ? item.notes.trim() : null
      }))
    );
    if (insertRes.error) {
      return { sheet: null, error: missingAliyotTable(insertRes.error.message) ? "missing_aliyot_table" : insertRes.error.message };
    }
  }

  return loadAliyahSheet(synagogueId, minyanId, serviceDate);
}

export async function loadAliyahWorkspace(synagogueId: string) {
  const [minyanim, congregants] = await Promise.all([
    listSynagogueMinyanOptions(synagogueId),
    listCongregants(synagogueId)
  ]);
  return {
    minyanim,
    congregants: congregants.error ? null : congregants.rows.map(toAliyahCongregantOption),
    error: congregants.error
  };
}
