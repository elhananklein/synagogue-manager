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

export type BirthDateSource = "gregorian" | "hebrew";
export type CongregantRegistrationStatus = "pending" | "approved";

export type CongregantInput = {
  minyanId: string | null;
  firstName: string;
  middleName: string;
  lastName: string;
  nickname: string;
  fatherName: string;
  motherName: string;
  tribe: CongregantTribe;
  gregorianBirthDate: string;
  hebrewBirthYear: number;
  hebrewBirthMonth: number;
  hebrewBirthDay: number;
  bornAfterSunset: boolean;
  phone: string;
  email: string;
  isActive: boolean;
  receivesAliyah: boolean;
  registrationStatus: CongregantRegistrationStatus;
  notes: string;
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
    tribe: "yisrael",
    gregorianBirthDate: "",
    hebrewBirthYear: 0,
    hebrewBirthMonth: 7,
    hebrewBirthDay: 1,
    bornAfterSunset: false,
    phone: "",
    email: "",
    isActive: true,
    receivesAliyah: true,
    registrationStatus: "approved",
    notes: ""
  };
}

export function normalizePhone(raw: string | null | undefined): string {
  let text = String(raw ?? "").trim().replace(/[\s\-().]/g, "");
  if (!text) return "";
  if (text.startsWith("+972")) text = `0${text.slice(4)}`;
  else if (text.startsWith("972") && text.length >= 12) text = `0${text.slice(3)}`;
  return text;
}

export function congregantPrayerName(input: Pick<CongregantInput, "firstName" | "middleName" | "nickname" | "fatherName">) {
  const given = [input.nickname.trim() || input.firstName.trim(), input.middleName.trim()].filter(Boolean).join(" ");
  const father = input.fatherName.trim();
  if (!given) return "";
  return father ? `${given} בן ${father}` : given;
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

export function validateCongregantInput(
  input: CongregantInput,
  minyanIds: Set<string>,
  options?: { requirePhone?: boolean }
) {
  const errors: string[] = [];
  if (!input.firstName.trim()) errors.push("יש למלא שם פרטי");
  if (!input.lastName.trim()) errors.push("יש למלא שם משפחה");
  if (!isCongregantTribe(input.tribe)) errors.push("יש לבחור כהן, לוי או ישראל");
  if (input.minyanId && !minyanIds.has(input.minyanId)) errors.push("המניין שנבחר אינו שייך לבית הכנסת");
  if (input.email.trim() && !EMAIL_RE.test(input.email.trim())) errors.push("כתובת המייל אינה תקינה");
  const phone = normalizePhone(input.phone);
  if (options?.requirePhone && !phone) errors.push("יש למלא מספר טלפון");
  else if (input.phone.trim() && phone.length < 8) errors.push("מספר הטלפון קצר מדי");
  const dates = completeBirthDates(input, isIsoDate(input.gregorianBirthDate) ? "gregorian" : "hebrew");
  if (dates.error) errors.push(dates.error);
  return { errors, next: dates.next };
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
