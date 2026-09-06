import { getSupabaseAdminClient } from "@/lib/supabase-server";
import {
  congregantDisplayName,
  emptyCongregantInput,
  genderForRelation,
  inverseFamilyRelation,
  isCongregantGender,
  isCongregantTribe,
  isFamilyRelation,
  isYahrzeitRelation,
  normalizeFamilyMembers,
  normalizePhone,
  normalizeYahrzeits,
  parentDeathFromYahrzeits,
  type CongregantFamilyMember,
  type CongregantInput,
  type CongregantMinyanOption,
  type CongregantRecord,
  type CongregantYahrzeit
} from "@/lib/congregant-types";
import { isIsoDate } from "@/lib/hebrew-civil-date";

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
  gender?: string | null;
  tribe: string;
  gregorian_birth_date: string;
  hebrew_birth_year: number;
  hebrew_birth_month: number;
  hebrew_birth_day: number;
  born_after_sunset: boolean;
  father_died_gregorian_date?: string | null;
  father_died_hebrew_year?: number | null;
  father_died_hebrew_month?: number | null;
  father_died_hebrew_day?: number | null;
  father_died_after_sunset?: boolean | null;
  mother_died_gregorian_date?: string | null;
  mother_died_hebrew_year?: number | null;
  mother_died_hebrew_month?: number | null;
  mother_died_hebrew_day?: number | null;
  mother_died_after_sunset?: boolean | null;
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
  const fatherDeath = parentDeathFromYahrzeits(input.yahrzeits ?? [], "father");
  const motherDeath = parentDeathFromYahrzeits(input.yahrzeits ?? [], "mother");
  return {
    synagogue_id: synagogueId,
    minyan_id: input.minyanId,
    first_name: input.firstName.trim(),
    middle_name: trimToNull(input.middleName),
    last_name: input.lastName.trim(),
    nickname: trimToNull(input.nickname),
    father_name: trimToNull(input.fatherName),
    mother_name: trimToNull(input.motherName),
    gender: input.gender,
    tribe: input.tribe,
    gregorian_birth_date: input.gregorianBirthDate,
    hebrew_birth_year: input.hebrewBirthYear,
    hebrew_birth_month: input.hebrewBirthMonth,
    hebrew_birth_day: input.hebrewBirthDay,
    born_after_sunset: input.bornAfterSunset,
    father_died_gregorian_date: fatherDeath.gregorianDate,
    father_died_hebrew_year: fatherDeath.year,
    father_died_hebrew_month: fatherDeath.month,
    father_died_hebrew_day: fatherDeath.day,
    father_died_after_sunset: fatherDeath.afterSunset,
    mother_died_gregorian_date: motherDeath.gregorianDate,
    mother_died_hebrew_year: motherDeath.year,
    mother_died_hebrew_month: motherDeath.month,
    mother_died_hebrew_day: motherDeath.day,
    mother_died_after_sunset: motherDeath.afterSunset,
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
    gender: isCongregantGender(row.gender) ? row.gender : "male",
    tribe: isCongregantTribe(row.tribe) ? row.tribe : "yisrael",
    gregorianBirthDate: String(row.gregorian_birth_date).slice(0, 10),
    hebrewBirthYear: row.hebrew_birth_year,
    hebrewBirthMonth: row.hebrew_birth_month,
    hebrewBirthDay: row.hebrew_birth_day,
    bornAfterSunset: Boolean(row.born_after_sunset),
    yahrzeits: yahrzeitsFromParentColumns(row),
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
  "id, synagogue_id, minyan_id, first_name, middle_name, last_name, nickname, father_name, mother_name, gender, tribe, gregorian_birth_date, hebrew_birth_year, hebrew_birth_month, hebrew_birth_day, born_after_sunset, father_died_gregorian_date, father_died_hebrew_year, father_died_hebrew_month, father_died_hebrew_day, father_died_after_sunset, mother_died_gregorian_date, mother_died_hebrew_year, mother_died_hebrew_month, mother_died_hebrew_day, mother_died_after_sunset, phone, email, is_active, receives_aliyah, notes, created_at, updated_at, minyanim(name)";
const SELECT_FIELDS = `${SELECT_BASE}, registration_status`;

function missingStatusColumn(message: string) {
  return /registration_status/i.test(message) && (/does not exist|schema cache|could not find/i.test(message) || /column/i.test(message));
}

export async function getPublicJoinContext(synagogueId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "missing_service_role_key" as const };
  const withLogo = await supabase
    .from("synagogues")
    .select("id, name, logo_url, logo_updated_at")
    .eq("id", synagogueId)
    .maybeSingle();
  const synagogueRes =
    withLogo.error && /logo_url|logo_updated_at|schema cache|does not exist|could not find/i.test(withLogo.error.message)
      ? await supabase.from("synagogues").select("id, name").eq("id", synagogueId).maybeSingle()
      : withLogo;
  if (synagogueRes.error || !synagogueRes.data) return { error: "synagogue_not_found" as const };
  const row = synagogueRes.data as { id: string; name?: string | null; logo_url?: string | null; logo_updated_at?: string | null };
  const minyanim = await listSynagogueMinyanOptions(synagogueId);
  const logoUpdatedAt = typeof row.logo_updated_at === "string" ? row.logo_updated_at : null;
  const hasLogo = Boolean((typeof row.logo_url === "string" && row.logo_url.trim()) || logoUpdatedAt);
  return {
    synagogue: {
      id: String(row.id),
      name: String(row.name ?? ""),
      hasLogo,
      logoUpdatedAt
    },
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
  const record = rowToRecord(res.data as CongregantRow);
  const relations = await listCongregantRelations(synagogueId, congregantId);
  if (relations.error) return { row: { ...record, familyMembers: [] }, error: relations.error };
  const yahrzeits = await listCongregantYahrzeits(synagogueId, congregantId, record);
  if (yahrzeits.error) return { row: { ...record, familyMembers: relations.links }, error: yahrzeits.error };
  return { row: { ...record, familyMembers: relations.links, yahrzeits: yahrzeits.rows } };
}

export async function insertCongregant(synagogueId: string, input: CongregantInput) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { row: null, error: "missing_service_role_key" };
  const payload = inputToRow(synagogueId, input);
  const res = await supabase.from("congregants").insert(payload).select(SELECT_FIELDS).single();
  if (res.error && missingStatusColumn(res.error.message) && payload.registration_status === "approved") {
    const withoutStatus = Object.fromEntries(
      Object.entries(payload).filter(([key]) => key !== "registration_status")
    );
    const fallback = await supabase.from("congregants").insert(withoutStatus).select(SELECT_BASE).single();
    if (fallback.error) return { row: null, error: mapDbError(fallback.error.message, input) };
    const fallbackRecord = rowToRecord(fallback.data as CongregantRow);
    const fallbackYahrzeits = await replaceCongregantYahrzeits(synagogueId, fallbackRecord.id, input.yahrzeits);
    if (fallbackYahrzeits.error) return { row: { ...fallbackRecord, yahrzeits: [] }, error: fallbackYahrzeits.error };
    return { row: { ...fallbackRecord, yahrzeits: fallbackYahrzeits.rows } };
  }
  if (res.error) return { row: null, error: mapDbError(res.error.message, input) };
  const record = rowToRecord(res.data as CongregantRow);
  const yahrzeits = await replaceCongregantYahrzeits(synagogueId, record.id, input.yahrzeits);
  if (yahrzeits.error) return { row: { ...record, yahrzeits: [] }, error: yahrzeits.error };
  if (!normalizeFamilyMembers(input.familyMembers).length) {
    return { row: { ...record, yahrzeits: yahrzeits.rows } };
  }
  const relations = await replaceCongregantRelations(synagogueId, record.id, input.familyMembers);
  if (relations.error) return { row: { ...record, familyMembers: [], yahrzeits: yahrzeits.rows }, error: relations.error };
  return { row: { ...record, familyMembers: relations.links, yahrzeits: yahrzeits.rows } };
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
  const rows = ((res.data ?? []) as CongregantRow[]).map(rowToRecord);
  for (let i = 0; i < rows.length; i++) {
    const saved = await replaceCongregantYahrzeits(synagogueId, rows[i].id, inputs[i]?.yahrzeits ?? []);
    if (saved.error) return { rows, error: saved.error };
    rows[i] = { ...rows[i], yahrzeits: saved.rows };
  }
  return { rows };
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
  const record = rowToRecord(res.data as CongregantRow);
  const yahrzeits = await replaceCongregantYahrzeits(synagogueId, congregantId, input.yahrzeits);
  if (yahrzeits.error) return { row: { ...record, yahrzeits: [] }, error: yahrzeits.error };
  const relations = await replaceCongregantRelations(synagogueId, congregantId, input.familyMembers);
  if (relations.error) {
    return { row: { ...record, familyMembers: [], yahrzeits: yahrzeits.rows }, error: relations.error };
  }
  return { row: { ...record, familyMembers: relations.links, yahrzeits: yahrzeits.rows } };
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
  if (
    lower.includes("congregant_yahrzeits") &&
    (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find"))
  ) {
    return "missing_yahrzeits_table";
  }
  if (lower.includes("congregants") && (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find"))) {
    return "missing_congregants_table";
  }
  if (
    (lower.includes("gender") ||
      lower.includes("father_died") ||
      lower.includes("mother_died") ||
      lower.includes("congregant_relations")) &&
    (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find"))
  ) {
    return "missing_family_yahrzeit";
  }
  return message;
}

export async function listCongregantRelations(synagogueId: string, congregantId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { links: [] as CongregantFamilyMember[], error: "missing_service_role_key" };
  const res = await supabase
    .from("congregant_relations")
    .select("related_id, relation")
    .eq("synagogue_id", synagogueId)
    .eq("congregant_id", congregantId);
  if (res.error) {
    if (/congregant_relations/i.test(res.error.message) && /does not exist|schema cache|could not find/i.test(res.error.message)) {
      return { links: [] as CongregantFamilyMember[], error: "missing_family_yahrzeit" };
    }
    return { links: [] as CongregantFamilyMember[], error: mapDbError(res.error.message) };
  }
  const rawLinks = (res.data ?? []) as Array<{ related_id: string; relation: string }>;
  const ids = rawLinks.map((row) => row.related_id);
  const people =
    ids.length === 0
      ? { data: [] as Array<{ id: string; first_name: string; last_name: string; gender: string }>, error: null }
      : await supabase.from("congregants").select("id, first_name, last_name, gender").eq("synagogue_id", synagogueId).in("id", ids);
  if (people.error) return { links: [] as CongregantFamilyMember[], error: mapDbError(people.error.message) };
  const byId = new Map(
    (people.data ?? []).map((row) => [
      String(row.id),
      {
        relatedName: congregantDisplayName({
          firstName: String(row.first_name ?? ""),
          middleName: "",
          lastName: String(row.last_name ?? "")
        }),
        relatedGender: (isCongregantGender(row.gender) ? row.gender : "male") as CongregantFamilyMember["relatedGender"]
      }
    ])
  );
  const links: CongregantFamilyMember[] = [];
  for (const raw of rawLinks) {
    if (!isFamilyRelation(raw.relation)) continue;
    const person = byId.get(raw.related_id);
    links.push({
      relatedId: raw.related_id,
      relation: raw.relation,
      relatedName: person?.relatedName ?? "מתפלל",
      relatedGender: person?.relatedGender ?? genderForRelation(raw.relation)
    });
  }
  return { links };
}

export async function replaceCongregantRelations(
  synagogueId: string,
  congregantId: string,
  rawLinks: CongregantInput["familyMembers"]
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { links: [] as CongregantFamilyMember[], error: "missing_service_role_key" };
  const links = normalizeFamilyMembers(rawLinks).filter((item) => item.relatedId !== congregantId);
  const clearOutgoing = await supabase
    .from("congregant_relations")
    .delete()
    .eq("synagogue_id", synagogueId)
    .eq("congregant_id", congregantId);
  if (clearOutgoing.error) return { links: [] as CongregantFamilyMember[], error: mapDbError(clearOutgoing.error.message) };
  const clearSpouses = await supabase
    .from("congregant_relations")
    .delete()
    .eq("synagogue_id", synagogueId)
    .eq("related_id", congregantId)
    .in("relation", ["husband", "wife"]);
  if (clearSpouses.error) return { links: [] as CongregantFamilyMember[], error: mapDbError(clearSpouses.error.message) };
  if (!links.length) return { links: [] as CongregantFamilyMember[] };

  const relatedIds = links.map((item) => item.relatedId);
  const people = await supabase
    .from("congregants")
    .select("id, first_name, last_name, gender")
    .eq("synagogue_id", synagogueId)
    .in("id", relatedIds);
  if (people.error) return { links: [] as CongregantFamilyMember[], error: mapDbError(people.error.message) };
  const byId = new Map(
    (people.data ?? []).map((row) => [
      String(row.id),
      {
        name: congregantDisplayName({
          firstName: String(row.first_name ?? ""),
          middleName: "",
          lastName: String(row.last_name ?? "")
        }),
        gender: isCongregantGender(row.gender) ? row.gender : "male"
      }
    ])
  );

  for (const link of links) {
    const person = byId.get(link.relatedId);
    if (!person) return { links: [] as CongregantFamilyMember[], error: "family_member_not_found" };
    if (person.gender !== genderForRelation(link.relation)) {
      return { links: [] as CongregantFamilyMember[], error: "family_gender_mismatch" };
    }
  }

  const rows = links.flatMap((link) => {
    const inverse = inverseFamilyRelation(link.relation);
    const base = {
      synagogue_id: synagogueId,
      congregant_id: congregantId,
      related_id: link.relatedId,
      relation: link.relation
    };
    if (!inverse) return [base];
    return [
      base,
      {
        synagogue_id: synagogueId,
        congregant_id: link.relatedId,
        related_id: congregantId,
        relation: inverse
      }
    ];
  });

  const inserted = await supabase.from("congregant_relations").insert(rows);
  if (inserted.error) return { links: [] as CongregantFamilyMember[], error: mapDbError(inserted.error.message) };

  return {
    links: links.map((link) => {
      const person = byId.get(link.relatedId);
      return {
        relatedId: link.relatedId,
        relation: link.relation,
        relatedName: person?.name ?? "",
        relatedGender: person?.gender ?? genderForRelation(link.relation)
      };
    })
  };
}

function yahrzeitsFromParentColumns(row: CongregantRow): CongregantYahrzeit[] {
  const items: CongregantYahrzeit[] = [];
  if (row.father_died_gregorian_date || row.father_died_hebrew_year) {
    items.push({
      id: "",
      relation: "father",
      personName: row.father_name ?? "",
      gregorianDate: row.father_died_gregorian_date ? String(row.father_died_gregorian_date).slice(0, 10) : "",
      hebrewYear: row.father_died_hebrew_year ?? 0,
      hebrewMonth: row.father_died_hebrew_month ?? 7,
      hebrewDay: row.father_died_hebrew_day ?? 1,
      afterSunset: Boolean(row.father_died_after_sunset)
    });
  }
  if (row.mother_died_gregorian_date || row.mother_died_hebrew_year) {
    items.push({
      id: "",
      relation: "mother",
      personName: row.mother_name ?? "",
      gregorianDate: row.mother_died_gregorian_date ? String(row.mother_died_gregorian_date).slice(0, 10) : "",
      hebrewYear: row.mother_died_hebrew_year ?? 0,
      hebrewMonth: row.mother_died_hebrew_month ?? 7,
      hebrewDay: row.mother_died_hebrew_day ?? 1,
      afterSunset: Boolean(row.mother_died_after_sunset)
    });
  }
  return items;
}

function mapYahrzeitRow(row: {
  id?: string;
  relation?: string;
  person_name?: string | null;
  gregorian_date?: string | null;
  hebrew_year?: number | null;
  hebrew_month?: number | null;
  hebrew_day?: number | null;
  after_sunset?: boolean | null;
}): CongregantYahrzeit | null {
  if (!isYahrzeitRelation(row.relation)) return null;
  return {
    id: String(row.id ?? ""),
    relation: row.relation,
    personName: String(row.person_name ?? "").trim(),
    gregorianDate: row.gregorian_date ? String(row.gregorian_date).slice(0, 10) : "",
    hebrewYear: row.hebrew_year ?? 0,
    hebrewMonth: row.hebrew_month ?? 7,
    hebrewDay: row.hebrew_day ?? 1,
    afterSunset: Boolean(row.after_sunset)
  };
}

export async function listCongregantYahrzeits(
  synagogueId: string,
  congregantId: string,
  fallbackRecord?: CongregantRecord
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: [] as CongregantYahrzeit[], error: "missing_service_role_key" };
  const res = await supabase
    .from("congregant_yahrzeits")
    .select("id, relation, person_name, gregorian_date, hebrew_year, hebrew_month, hebrew_day, after_sunset")
    .eq("synagogue_id", synagogueId)
    .eq("congregant_id", congregantId)
    .order("created_at", { ascending: true });
  if (res.error) {
    if (
      /congregant_yahrzeits/i.test(res.error.message) &&
      /does not exist|schema cache|could not find/i.test(res.error.message)
    ) {
      return { rows: fallbackRecord?.yahrzeits ?? [] };
    }
    return { rows: [] as CongregantYahrzeit[], error: mapDbError(res.error.message) };
  }
  const rows = (res.data ?? []).map(mapYahrzeitRow).filter((item): item is CongregantYahrzeit => Boolean(item));
  if (rows.length) return { rows };
  return { rows: fallbackRecord?.yahrzeits ?? [] };
}

export async function replaceCongregantYahrzeits(
  synagogueId: string,
  congregantId: string,
  rawItems: CongregantInput["yahrzeits"]
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: [] as CongregantYahrzeit[], error: "missing_service_role_key" };
  const items = normalizeYahrzeits(rawItems);
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const extras = items.filter((item) => item.relation !== "father" && item.relation !== "mother");
  const res = await supabase.from("congregant_yahrzeits").delete().eq("synagogue_id", synagogueId).eq("congregant_id", congregantId);
  if (res.error) {
    if (
      /congregant_yahrzeits/i.test(res.error.message) &&
      /does not exist|schema cache|could not find/i.test(res.error.message)
    ) {
      if (extras.length) return { rows: [] as CongregantYahrzeit[], error: "missing_yahrzeits_table" };
      return { rows: items };
    }
    return { rows: [] as CongregantYahrzeit[], error: mapDbError(res.error.message) };
  }
  if (!items.length) return { rows: [] as CongregantYahrzeit[] };
  const inserted = await supabase
    .from("congregant_yahrzeits")
    .insert(
      items.map((item) => ({
        ...(item.id && uuidRe.test(item.id) ? { id: item.id } : {}),
        synagogue_id: synagogueId,
        congregant_id: congregantId,
        relation: item.relation,
        person_name: item.personName,
        gregorian_date: isIsoDate(item.gregorianDate) ? item.gregorianDate : null,
        hebrew_year: item.hebrewYear >= 5000 ? item.hebrewYear : null,
        hebrew_month: item.hebrewYear >= 5000 ? item.hebrewMonth : null,
        hebrew_day: item.hebrewYear >= 5000 ? item.hebrewDay : null,
        after_sunset: item.afterSunset
      }))
    )
    .select("id, relation, person_name, gregorian_date, hebrew_year, hebrew_month, hebrew_day, after_sunset");
  if (inserted.error) return { rows: [] as CongregantYahrzeit[], error: mapDbError(inserted.error.message) };
  return {
    rows: (inserted.data ?? []).map(mapYahrzeitRow).filter((item): item is CongregantYahrzeit => Boolean(item))
  };
}

function sortListedCongregants(rows: CongregantRecord[]) {
  return [...rows].sort((a, b) => {
    if (a.registrationStatus !== b.registrationStatus) {
      return a.registrationStatus === "pending" ? -1 : 1;
    }
    return congregantDisplayName(a).localeCompare(congregantDisplayName(b), "he");
  });
}
