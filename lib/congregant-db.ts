import { getSupabaseAdminClient } from "@/lib/supabase-server";
import {
  congregantDisplayName,
  emptyCongregantInput,
  isCongregantTribe,
  normalizePhone,
  type CongregantInput,
  type CongregantMinyanOption,
  type CongregantRecord
} from "@/lib/congregant-types";

type CongregantRow = {
  id: string;
  synagogue_id: string;
  minyan_id: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  nickname: string | null;
  father_name: string | null;
  mother_name: string | null;
  tribe: string;
  gregorian_birth_date: string;
  hebrew_birth_year: number;
  hebrew_birth_month: number;
  hebrew_birth_day: number;
  born_after_sunset: boolean;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  receives_aliyah: boolean;
  registration_status?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  minyanim?: { name: string } | { name: string }[] | null;
};

function trimToNull(value: string) {
  const text = value.trim();
  return text ? text : null;
}

export function inputToRow(synagogueId: string, input: CongregantInput) {
  return {
    synagogue_id: synagogueId,
    minyan_id: input.minyanId,
    first_name: input.firstName.trim(),
    middle_name: trimToNull(input.middleName),
    last_name: input.lastName.trim(),
    nickname: trimToNull(input.nickname),
    father_name: trimToNull(input.fatherName),
    mother_name: trimToNull(input.motherName),
    tribe: input.tribe,
    gregorian_birth_date: input.gregorianBirthDate,
    hebrew_birth_year: input.hebrewBirthYear,
    hebrew_birth_month: input.hebrewBirthMonth,
    hebrew_birth_day: input.hebrewBirthDay,
    born_after_sunset: input.bornAfterSunset,
    phone: trimToNull(normalizePhone(input.phone)),
    email: trimToNull(input.email.toLowerCase()),
    is_active: input.isActive,
    receives_aliyah: input.receivesAliyah,
    registration_status: input.registrationStatus === "pending" ? "pending" : "approved",
    notes: trimToNull(input.notes)
  };
}

export function rowToRecord(row: CongregantRow): CongregantRecord {
  const minyanName = Array.isArray(row.minyanim) ? row.minyanim[0]?.name : row.minyanim?.name;
  const base = emptyCongregantInput(row.minyan_id);
  return {
    ...base,
    id: row.id,
    synagogueId: row.synagogue_id,
    minyanId: row.minyan_id,
    firstName: row.first_name,
    middleName: row.middle_name ?? "",
    lastName: row.last_name,
    nickname: row.nickname ?? "",
    fatherName: row.father_name ?? "",
    motherName: row.mother_name ?? "",
    tribe: isCongregantTribe(row.tribe) ? row.tribe : "yisrael",
    gregorianBirthDate: String(row.gregorian_birth_date).slice(0, 10),
    hebrewBirthYear: row.hebrew_birth_year,
    hebrewBirthMonth: row.hebrew_birth_month,
    hebrewBirthDay: row.hebrew_birth_day,
    bornAfterSunset: Boolean(row.born_after_sunset),
    phone: row.phone ?? "",
    email: row.email ?? "",
    isActive: row.is_active,
    receivesAliyah: row.receives_aliyah,
    registrationStatus: row.registration_status === "pending" ? "pending" : "approved",
    notes: row.notes ?? "",
    minyanName: minyanName ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listSynagogueMinyanOptions(synagogueId: string): Promise<CongregantMinyanOption[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const res = await supabase
    .from("minyanim")
    .select("id, name, display_style, display_palette, display_font")
    .eq("synagogue_id", synagogueId)
    .order("created_at", { ascending: true });
  if (res.error || !res.data) return [];
  return res.data.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    displayStyle: String(row.display_style ?? "classic"),
    displayPalette: typeof row.display_palette === "string" ? row.display_palette : null,
    displayFont: typeof row.display_font === "string" ? row.display_font : null
  }));
}

const SELECT_BASE =
  "id, synagogue_id, minyan_id, first_name, middle_name, last_name, nickname, father_name, mother_name, tribe, gregorian_birth_date, hebrew_birth_year, hebrew_birth_month, hebrew_birth_day, born_after_sunset, phone, email, is_active, receives_aliyah, notes, created_at, updated_at, minyanim(name)";
const SELECT_FIELDS = `${SELECT_BASE}, registration_status`;

function missingStatusColumn(message: string) {
  return /registration_status/i.test(message) && (/does not exist|schema cache|could not find/i.test(message) || /column/i.test(message));
}

export async function getPublicJoinContext(synagogueId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "missing_service_role_key" as const };
  const synagogueRes = await supabase.from("synagogues").select("id, name").eq("id", synagogueId).maybeSingle();
  if (synagogueRes.error || !synagogueRes.data) return { error: "synagogue_not_found" as const };
  const minyanim = await listSynagogueMinyanOptions(synagogueId);
  return {
    synagogue: { id: String(synagogueRes.data.id), name: String(synagogueRes.data.name ?? "") },
    minyanim
  };
}

export async function listCongregants(synagogueId: string): Promise<{ rows: CongregantRecord[]; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: [], error: "missing_service_role_key" };
  const res = await supabase
    .from("congregants")
    .select(SELECT_FIELDS)
    .eq("synagogue_id", synagogueId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (res.error && missingStatusColumn(res.error.message)) {
    const fallback = await supabase
      .from("congregants")
      .select(SELECT_BASE)
      .eq("synagogue_id", synagogueId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });
    if (fallback.error) return { rows: [], error: mapDbError(fallback.error.message) };
    const rows = ((fallback.data ?? []) as CongregantRow[]).map(rowToRecord);
    return { rows: sortListedCongregants(rows) };
  }
  if (res.error) return { rows: [], error: mapDbError(res.error.message) };
  return { rows: sortListedCongregants(((res.data ?? []) as CongregantRow[]).map(rowToRecord)) };
}

export async function getCongregant(synagogueId: string, congregantId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { row: null, error: "missing_service_role_key" };
  const res = await supabase
    .from("congregants")
    .select(SELECT_FIELDS)
    .eq("synagogue_id", synagogueId)
    .eq("id", congregantId)
    .maybeSingle();
  if (res.error) return { row: null, error: mapDbError(res.error.message) };
  if (!res.data) return { row: null, error: "not_found" };
  return { row: rowToRecord(res.data as CongregantRow) };
}

export async function insertCongregant(synagogueId: string, input: CongregantInput) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { row: null, error: "missing_service_role_key" };
  const row = inputToRow(synagogueId, input);
  const res = await supabase.from("congregants").insert(row).select(SELECT_FIELDS).single();
  if (res.error && missingStatusColumn(res.error.message) && row.registration_status === "approved") {
    const withoutStatus = { ...row };
    delete withoutStatus.registration_status;
    const fallback = await supabase.from("congregants").insert(withoutStatus).select(SELECT_BASE).single();
    if (fallback.error) return { row: null, error: mapDbError(fallback.error.message, input) };
    return { row: rowToRecord(fallback.data as CongregantRow) };
  }
  if (res.error) return { row: null, error: mapDbError(res.error.message, input) };
  return { row: rowToRecord(res.data as CongregantRow) };
}

export async function insertCongregants(synagogueId: string, inputs: CongregantInput[]) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: [] as CongregantRecord[], error: "missing_service_role_key" };
  if (!inputs.length) return { rows: [] };
  const res = await supabase
    .from("congregants")
    .insert(inputs.map((input) => inputToRow(synagogueId, input)))
    .select(SELECT_FIELDS);
  if (res.error) return { rows: [], error: mapDbError(res.error.message, inputs[0]) };
  return { rows: ((res.data ?? []) as CongregantRow[]).map(rowToRecord) };
}

export async function updateCongregant(synagogueId: string, congregantId: string, input: CongregantInput) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { row: null, error: "missing_service_role_key" };
  const res = await supabase
    .from("congregants")
    .update(inputToRow(synagogueId, input))
    .eq("synagogue_id", synagogueId)
    .eq("id", congregantId)
    .select(SELECT_FIELDS)
    .maybeSingle();
  if (res.error) return { row: null, error: mapDbError(res.error.message, input) };
  if (!res.data) return { row: null, error: "not_found" };
  return { row: rowToRecord(res.data as CongregantRow) };
}

export async function setCongregantRegistrationStatus(
  synagogueId: string,
  congregantId: string,
  status: "pending" | "approved"
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { row: null, error: "missing_service_role_key" };
  const res = await supabase
    .from("congregants")
    .update({ registration_status: status })
    .eq("synagogue_id", synagogueId)
    .eq("id", congregantId)
    .select(SELECT_FIELDS)
    .maybeSingle();
  if (res.error) return { row: null, error: mapDbError(res.error.message) };
  if (!res.data) return { row: null, error: "not_found" };
  return { row: rowToRecord(res.data as CongregantRow) };
}

export async function deleteCongregant(synagogueId: string, congregantId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "missing_service_role_key" };
  const res = await supabase.from("congregants").delete().eq("synagogue_id", synagogueId).eq("id", congregantId);
  if (res.error) return { error: res.error.message };
  return {};
}

export function mapDbError(message: string, input?: CongregantInput) {
  const lower = message.toLowerCase();
  if (lower.includes("idx_congregants_synagogue_phone") || (lower.includes("phone") && lower.includes("unique"))) {
    return input?.phone ? `הטלפון ${normalizePhone(input.phone)} כבר רשום בבית הכנסת` : "טלפון כבר רשום בבית הכנסת";
  }
  if (lower.includes("idx_congregants_synagogue_email") || (lower.includes("email") && lower.includes("unique"))) {
    return input?.email ? `המייל ${input.email.trim()} כבר רשום בבית הכנסת` : "מייל כבר רשום בבית הכנסת";
  }
  if (lower.includes("registration_status") && (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find"))) {
    return "missing_registration_status";
  }
  if (lower.includes("congregants") && (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find"))) {
    return "missing_congregants_table";
  }
  return message;
}

function sortListedCongregants(rows: CongregantRecord[]) {
  return [...rows].sort((a, b) => {
    if (a.registrationStatus !== b.registrationStatus) {
      return a.registrationStatus === "pending" ? -1 : 1;
    }
    return congregantDisplayName(a).localeCompare(congregantDisplayName(b), "he");
  });
}
