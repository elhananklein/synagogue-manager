import {
  formatHebrewDate,
  gregorianToHebrew,
  hebrewToGregorian,
  isIsoDate,
  isValidHebrewDate,
  parseHebrewMonth
} from "@/lib/hebrew-civil-date";

export const CONGREGANT_TRIBES = ["kohen", "levi", "yisrael"] as const;
export type CongregantTribe = (typeof CONGREGANT_TRIBES)[number];

export const CONGREGANT_TRIBE_LABELS: Record<CongregantTribe, string> = {
  kohen: "כהן",
  levi: "לוי",
  yisrael: "ישראל"
};

export const CONGREGANT_GENDERS = ["male", "female"] as const;
export type CongregantGender = (typeof CONGREGANT_GENDERS)[number];

export const CONGREGANT_GENDER_LABELS: Record<CongregantGender, string> = {
  male: "גבר",
  female: "אשה"
};

export const FAMILY_RELATIONS = ["son", "daughter", "husband", "wife"] as const;
export type FamilyRelation = (typeof FAMILY_RELATIONS)[number];

export const FAMILY_RELATION_LABELS: Record<FamilyRelation, string> = {
  son: "בן",
  daughter: "בת",
  husband: "בעל",
  wife: "אשה"
};

/** שבעה קרובים + סבא וסבתא — ליארצייט בכרטיס המתפלל. */
export const YAHRZEIT_RELATIONS = [
  "father",
  "mother",
  "son",
  "daughter",
  "brother",
  "sister",
  "spouse",
  "grandfather",
  "grandmother"
] as const;
export type YahrzeitRelation = (typeof YAHRZEIT_RELATIONS)[number];

export const YAHRZEIT_RELATION_LABELS: Record<YahrzeitRelation, string> = {
  father: "אב",
  mother: "אם",
  son: "בן",
  daughter: "בת",
  brother: "אח",
  sister: "אחות",
  spouse: "בן/בת זוג",
  grandfather: "סבא",
  grandmother: "סבתא"
};

export type CongregantYahrzeit = {
  id: string;
  relation: YahrzeitRelation;
  personName: string;
  gregorianDate: string;
  hebrewYear: number;
  hebrewMonth: number;
  hebrewDay: number;
  afterSunset: boolean;
};

export type BirthDateSource = "gregorian" | "hebrew";
export type CongregantRegistrationStatus = "pending" | "approved";

export type CongregantFamilyLink = {
  relatedId: string;
  relation: FamilyRelation;
};

export type CongregantFamilyMember = CongregantFamilyLink & {
  relatedName: string;
  relatedGender: CongregantGender;
};

export type CongregantInput = {
  minyanId: string | null;
  firstName: string;
  middleName: string;
  lastName: string;
  nickname: string;
  fatherName: string;
  motherName: string;
  gender: CongregantGender;
  tribe: CongregantTribe;
  gregorianBirthDate: string;
  hebrewBirthYear: number;
  hebrewBirthMonth: number;
  hebrewBirthDay: number;
  bornAfterSunset: boolean;
  yahrzeits: CongregantYahrzeit[];
  phone: string;
  email: string;
  isActive: boolean;
  receivesAliyah: boolean;
  registrationStatus: CongregantRegistrationStatus;
  notes: string;
  familyMembers: CongregantFamilyLink[];
};

export type CongregantRecord = CongregantInput & {
  id: string;
  synagogueId: string;
  minyanName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CongregantMinyanOption = {
  id: string;
  name: string;
  displayStyle: string;
  displayPalette: string | null;
  displayFont: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isCongregantTribe(value: string | null | undefined): value is CongregantTribe {
  return CONGREGANT_TRIBES.includes(value as CongregantTribe);
}

export function isCongregantGender(value: string | null | undefined): value is CongregantGender {
  return CONGREGANT_GENDERS.includes(value as CongregantGender);
}

export function parseCongregantGender(raw: string | null | undefined): CongregantGender | null {
  const text = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!text) return null;
  if (["male", "m", "גבר", "זכר", "איש"].includes(text)) return "male";
  if (["female", "f", "אשה", "אישה", "נקבה"].includes(text)) return "female";
  return isCongregantGender(text) ? text : null;
}

export function isFamilyRelation(value: string | null | undefined): value is FamilyRelation {
  return FAMILY_RELATIONS.includes(value as FamilyRelation);
}

export function genderForRelation(relation: FamilyRelation): CongregantGender {
  return relation === "daughter" || relation === "wife" ? "female" : "male";
}

export function inverseFamilyRelation(relation: FamilyRelation): FamilyRelation | null {
  if (relation === "husband") return "wife";
  if (relation === "wife") return "husband";
  return null;
}

export function parseCongregantTribe(raw: string | null | undefined): CongregantTribe | null {
  const text = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!text) return null;
  if (text === "kohen" || text === "כהן" || text === "כהנים") return "kohen";
  if (text === "levi" || text === "לוי" || text === "לויים") return "levi";
  if (text === "yisrael" || text === "israel" || text === "ישראל" || text === "ישראלים") return "yisrael";
  return isCongregantTribe(text) ? text : null;
}

export function emptyCongregantInput(minyanId: string | null = null): CongregantInput {
  return {
    minyanId,
    firstName: "",
    middleName: "",
    lastName: "",
    nickname: "",
    fatherName: "",
    motherName: "",
    gender: "male",
    tribe: "yisrael",
    gregorianBirthDate: "",
    hebrewBirthYear: 0,
    hebrewBirthMonth: 7,
    hebrewBirthDay: 1,
    bornAfterSunset: false,
    yahrzeits: [],
    phone: "",
    email: "",
    isActive: true,
    receivesAliyah: true,
    registrationStatus: "approved",
    notes: "",
    familyMembers: []
  };
}

export function normalizePhone(raw: string | null | undefined): string {
  let text = String(raw ?? "").trim().replace(/[\s\-().]/g, "");
  if (!text) return "";
  if (text.startsWith("+972")) text = `0${text.slice(4)}`;
  else if (text.startsWith("972") && text.length >= 12) text = `0${text.slice(3)}`;
  return text;
}

export function congregantPrayerName(
  input: Pick<CongregantInput, "firstName" | "middleName" | "nickname" | "fatherName" | "gender">
) {
  const given = [input.nickname.trim() || input.firstName.trim(), input.middleName.trim()].filter(Boolean).join(" ");
  const father = input.fatherName.trim();
  if (!given) return "";
  const childWord = input.gender === "female" ? "בת" : "בן";
  return father ? `${given} ${childWord} ${father}` : given;
}

export function congregantDisplayName(input: Pick<CongregantInput, "firstName" | "middleName" | "lastName">) {
  return [input.firstName, input.middleName, input.lastName].map((part) => part.trim()).filter(Boolean).join(" ");
}

export function applyBirthConversion(
  input: CongregantInput,
  source: BirthDateSource
): { next: CongregantInput; error: string | null } {
  const afterSunset = input.bornAfterSunset;
  if (source === "gregorian") {
    if (!isIsoDate(input.gregorianBirthDate)) {
      return { next: input, error: "יש למלא תאריך לידה לועזי מלא, כולל שנה" };
    }
    const hebrew = gregorianToHebrew(input.gregorianBirthDate, afterSunset);
    if (!hebrew) return { next: input, error: "לא הצלחנו להמיר את התאריך הלועזי" };
    return {
      next: {
        ...input,
        hebrewBirthYear: hebrew.year,
        hebrewBirthMonth: hebrew.month,
        hebrewBirthDay: hebrew.day
      },
      error: null
    };
  }
  const hebrew = {
    year: input.hebrewBirthYear,
    month: input.hebrewBirthMonth,
    day: input.hebrewBirthDay
  };
  if (!isValidHebrewDate(hebrew)) {
    return { next: input, error: "יש למלא תאריך לידה עברי מלא ותקין, כולל שנה" };
  }
  const gregorian = hebrewToGregorian(hebrew, afterSunset);
  if (!gregorian) return { next: input, error: "לא הצלחנו להמיר את התאריך העברי" };
  return { next: { ...input, gregorianBirthDate: gregorian }, error: null };
}

export function completeBirthDates(
  input: CongregantInput,
  preferredSource: BirthDateSource
): { next: CongregantInput; source: BirthDateSource; error: string | null } {
  const hasGregorian = isIsoDate(input.gregorianBirthDate);
  const hasHebrew = isValidHebrewDate({
    year: input.hebrewBirthYear,
    month: input.hebrewBirthMonth,
    day: input.hebrewBirthDay
  });
  if (hasGregorian && hasHebrew) {
    const fromGregorian = applyBirthConversion(input, "gregorian");
    if (fromGregorian.error) return { next: input, source: preferredSource, error: fromGregorian.error };
    const match =
      fromGregorian.next.hebrewBirthYear === input.hebrewBirthYear &&
      fromGregorian.next.hebrewBirthMonth === input.hebrewBirthMonth &&
      fromGregorian.next.hebrewBirthDay === input.hebrewBirthDay;
    if (!match && preferredSource === "hebrew") {
      return { ...applyBirthConversion(input, "hebrew"), source: "hebrew" };
    }
    if (!match) {
      return {
        next: input,
        source: preferredSource,
        error: `התאריך הלועזי והעברי לא תואמים (לפי הלועזי: ${formatHebrewDate({
          year: fromGregorian.next.hebrewBirthYear,
          month: fromGregorian.next.hebrewBirthMonth,
          day: fromGregorian.next.hebrewBirthDay
        })})`
      };
    }
    return { next: input, source: preferredSource, error: null };
  }
  if (hasGregorian) return { ...applyBirthConversion(input, "gregorian"), source: "gregorian" };
  if (hasHebrew) return { ...applyBirthConversion(input, "hebrew"), source: "hebrew" };
  return { next: input, source: preferredSource, error: "יש למלא תאריך לידה לועזי או עברי, כולל שנה" };
}

export function isYahrzeitRelation(value: string | null | undefined): value is YahrzeitRelation {
  return YAHRZEIT_RELATIONS.includes(value as YahrzeitRelation);
}

export function emptyYahrzeit(relation: YahrzeitRelation = "father"): CongregantYahrzeit {
  return {
    id: "",
    relation,
    personName: "",
    gregorianDate: "",
    hebrewYear: 0,
    hebrewMonth: 7,
    hebrewDay: 1,
    afterSunset: false
  };
}

export function yahrzeitDiedAfterSunsetLabel(relation: YahrzeitRelation) {
  if (relation === "mother" || relation === "daughter" || relation === "sister" || relation === "grandmother") {
    return "נפטרה אחרי השקיעה";
  }
  if (relation === "spouse") return "נפטר/ה אחרי השקיעה";
  return "נפטר אחרי השקיעה";
}

export function isYahrzeitStarted(item: CongregantYahrzeit): boolean {
  return isIsoDate(item.gregorianDate) || item.hebrewYear >= 5000 || item.hebrewDay > 1;
}

export function applyYahrzeitConversion(
  item: CongregantYahrzeit,
  source: BirthDateSource
): { next: CongregantYahrzeit; error: string | null } {
  const label = YAHRZEIT_RELATION_LABELS[item.relation];
  const started = isYahrzeitStarted(item);
  if (!started) {
    return {
      next: { ...item, gregorianDate: "", hebrewYear: 0, hebrewMonth: 7, hebrewDay: 1, afterSunset: item.afterSunset },
      error: null
    };
  }
  if (source === "gregorian") {
    if (!isIsoDate(item.gregorianDate)) {
      return { next: item, error: `יש למלא תאריך יארצייט (${label}) לועזי מלא, כולל שנה` };
    }
    const converted = gregorianToHebrew(item.gregorianDate, item.afterSunset);
    if (!converted) return { next: item, error: `לא הצלחנו להמיר את תאריך היארצייט (${label})` };
    return { next: { ...item, hebrewYear: converted.year, hebrewMonth: converted.month, hebrewDay: converted.day }, error: null };
  }
  const hebrew = { year: item.hebrewYear, month: item.hebrewMonth, day: item.hebrewDay };
  if (!isValidHebrewDate(hebrew)) {
    return { next: item, error: `יש למלא תאריך יארצייט (${label}) עברי מלא ותקין, כולל שנה` };
  }
  const converted = hebrewToGregorian(hebrew, item.afterSunset);
  if (!converted) return { next: item, error: `לא הצלחנו להמיר את תאריך היארצייט (${label})` };
  return { next: { ...item, gregorianDate: converted }, error: null };
}

export function normalizeYahrzeits(raw: CongregantYahrzeit[] | null | undefined): CongregantYahrzeit[] {
  if (!Array.isArray(raw)) return [];
  const out: CongregantYahrzeit[] = [];
  for (const item of raw) {
    if (!item || !isYahrzeitRelation(item.relation)) continue;
    out.push({
      id: typeof item.id === "string" ? item.id : "",
      relation: item.relation,
      personName: String(item.personName ?? "").trim(),
      gregorianDate: String(item.gregorianDate ?? "").trim(),
      hebrewYear: Number(item.hebrewYear) || 0,
      hebrewMonth: Number(item.hebrewMonth) || 7,
      hebrewDay: Number(item.hebrewDay) || 1,
      afterSunset: Boolean(item.afterSunset)
    });
  }
  return out;
}

export function completeYahrzeits(input: CongregantInput): { next: CongregantInput; error: string | null } {
  const nextItems: CongregantYahrzeit[] = [];
  for (const raw of normalizeYahrzeits(input.yahrzeits)) {
    const started = isYahrzeitStarted(raw);
    if (!started && !raw.personName) continue;
    if (!started && raw.personName) {
      return { next: input, error: `יש למלא תאריך יארצייט ל${YAHRZEIT_RELATION_LABELS[raw.relation]} או להסיר את השורה` };
    }
    const source: BirthDateSource = isIsoDate(raw.gregorianDate) ? "gregorian" : "hebrew";
    const converted = applyYahrzeitConversion(raw, source);
    if (converted.error) return { next: input, error: converted.error };
    nextItems.push(converted.next);
  }
  return { next: { ...input, yahrzeits: nextItems }, error: null };
}

export function parentDeathFromYahrzeits(yahrzeits: CongregantYahrzeit[], relation: "father" | "mother") {
  const item = yahrzeits.find((row) => row.relation === relation);
  if (!item || !isYahrzeitStarted(item)) {
    return { gregorianDate: null as string | null, year: null as number | null, month: null as number | null, day: null as number | null, afterSunset: false };
  }
  return {
    gregorianDate: isIsoDate(item.gregorianDate) ? item.gregorianDate : null,
    year: item.hebrewYear >= 5000 ? item.hebrewYear : null,
    month: item.hebrewYear >= 5000 ? item.hebrewMonth : null,
    day: item.hebrewYear >= 5000 ? item.hebrewDay : null,
    afterSunset: item.afterSunset
  };
}

export function yahrzeitFromLegacyDate(
  relation: "father" | "mother",
  gregorianDate: string,
  hebrewDay: number,
  hebrewMonth: number,
  hebrewYear: number,
  afterSunset = false,
  personName = ""
): CongregantYahrzeit | null {
  const item: CongregantYahrzeit = {
    ...emptyYahrzeit(relation),
    personName,
    gregorianDate,
    hebrewDay: hebrewDay || 1,
    hebrewMonth: hebrewMonth || 7,
    hebrewYear,
    afterSunset
  };
  return isYahrzeitStarted(item) ? item : null;
}

export const BIRTH_DATE_PATCH_KEYS = [
  "gregorianBirthDate",
  "hebrewBirthYear",
  "hebrewBirthMonth",
  "hebrewBirthDay",
  "bornAfterSunset"
] as const;

export function validateCongregantInput(
  input: CongregantInput,
  minyanIds: Set<string>,
  options?: { requirePhone?: boolean }
) {
  const errors: string[] = [];
  if (!input.firstName.trim()) errors.push("יש למלא שם פרטי");
  if (!input.lastName.trim()) errors.push("יש למלא שם משפחה");
  if (!isCongregantGender(input.gender)) errors.push("יש לבחור גבר או אשה");
  if (!isCongregantTribe(input.tribe)) errors.push("יש לבחור כהן, לוי או ישראל");
  if (input.minyanId && !minyanIds.has(input.minyanId)) errors.push("המניין שנבחר אינו שייך לבית הכנסת");
  if (input.email.trim() && !EMAIL_RE.test(input.email.trim())) errors.push("כתובת המייל אינה תקינה");
  const phone = normalizePhone(input.phone);
  if (options?.requirePhone && !phone) errors.push("יש למלא מספר טלפון");
  else if (input.phone.trim() && phone.length < 8) errors.push("מספר הטלפון קצר מדי");
  const dates = completeBirthDates(input, isIsoDate(input.gregorianBirthDate) ? "gregorian" : "hebrew");
  if (dates.error) errors.push(dates.error);
  const death = completeYahrzeits(dates.next);
  if (death.error) errors.push(death.error);
  const familyMembers = normalizeFamilyMembers(death.next.familyMembers);
  const seen = new Set<string>();
  for (const link of familyMembers) {
    if (seen.has(link.relatedId)) {
      errors.push("אותו בן משפחה מופיע יותר מפעם אחת");
      break;
    }
    seen.add(link.relatedId);
  }
  return { errors, next: { ...death.next, familyMembers } };
}

export function normalizeFamilyMembers(raw: CongregantFamilyLink[] | null | undefined): CongregantFamilyLink[] {
  if (!Array.isArray(raw)) return [];
  const out: CongregantFamilyLink[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const relatedId = typeof item?.relatedId === "string" ? item.relatedId.trim() : "";
    if (!relatedId || !isFamilyRelation(item?.relation) || seen.has(relatedId)) continue;
    seen.add(relatedId);
    out.push({ relatedId, relation: item.relation });
  }
  return out;
}

export function congregantJoinPath(synagogueId: string, minyanId?: string | null) {
  const params = new URLSearchParams({ synagogueId });
  if (minyanId) params.set("minyanId", minyanId);
  return `/join?${params.toString()}`;
}

export function parseOptionalHebrewMonth(raw: unknown) {
  if (raw == null || raw === "") return null;
  return parseHebrewMonth(typeof raw === "number" ? raw : String(raw));
}
