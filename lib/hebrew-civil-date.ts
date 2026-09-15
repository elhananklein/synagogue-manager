import { HDate, months } from "@hebcal/core";

export type HebrewBirthDate = {
  year: number;
  month: number;
  day: number;
};

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const HEBREW_MONTH_OPTIONS: Array<{
  month: number;
  label: string;
  leapOnly?: boolean;
}> = [
  { month: months.TISHREI, label: "תשרי" },
  { month: months.CHESHVAN, label: "חשון" },
  { month: months.KISLEV, label: "כסלו" },
  { month: months.TEVET, label: "טבת" },
  { month: months.SHVAT, label: "שבט" },
  { month: months.ADAR_I, label: "אדר / אדר א׳" },
  { month: months.ADAR_II, label: "אדר ב׳", leapOnly: true },
  { month: months.NISAN, label: "ניסן" },
  { month: months.IYYAR, label: "אייר" },
  { month: months.SIVAN, label: "סיון" },
  { month: months.TAMUZ, label: "תמוז" },
  { month: months.AV, label: "אב" },
  { month: months.ELUL, label: "אלול" }
];

const MONTH_ALIASES: Record<string, number> = {
  nisan: months.NISAN,
  nissan: months.NISAN,
  ניסן: months.NISAN,
  iyyar: months.IYYAR,
  iyar: months.IYYAR,
  אייר: months.IYYAR,
  sivan: months.SIVAN,
  סיון: months.SIVAN,
  סיוון: months.SIVAN,
  tamuz: months.TAMUZ,
  tammuz: months.TAMUZ,
  תמוז: months.TAMUZ,
  av: months.AV,
  אב: months.AV,
  elul: months.ELUL,
  אלול: months.ELUL,
  tishrei: months.TISHREI,
  tishri: months.TISHREI,
  תשרי: months.TISHREI,
  cheshvan: months.CHESHVAN,
  heshvan: months.CHESHVAN,
  מרחשון: months.CHESHVAN,
  חשון: months.CHESHVAN,
  kislev: months.KISLEV,
  כסלו: months.KISLEV,
  tevet: months.TEVET,
  טבת: months.TEVET,
  shvat: months.SHVAT,
  shevat: months.SHVAT,
  שבט: months.SHVAT,
  adar: months.ADAR_I,
  אדר: months.ADAR_I,
  "adar i": months.ADAR_I,
  "adar 1": months.ADAR_I,
  adari: months.ADAR_I,
  "אדר א": months.ADAR_I,
  "אדר א׳": months.ADAR_I,
  "אדר א'": months.ADAR_I,
  "adar ii": months.ADAR_II,
  "adar 2": months.ADAR_II,
  adarii: months.ADAR_II,
  "אדר ב": months.ADAR_II,
  "אדר ב׳": months.ADAR_II,
  "אדר ב'": months.ADAR_II
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function isIsoDate(value: string | null | undefined): boolean {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  const parsed = parseIsoDate(value);
  if (!parsed) return false;
  const dt = civilNoon(parsed.year, parsed.month, parsed.day);
  return dt.getFullYear() === parsed.year && dt.getMonth() + 1 === parsed.month && dt.getDate() === parsed.day;
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE_RE.exec(value.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function civilNoon(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function shiftCivilDays(year: number, month: number, day: number, delta: number) {
  const dt = civilNoon(year, month, day);
  dt.setDate(dt.getDate() + delta);
  return { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate() };
}

export function formatIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function isHebrewLeapYear(year: number) {
  if (!Number.isInteger(year) || year < 1) return false;
  return new HDate(1, months.TISHREI, year).isLeapYear();
}

export function hebrewMonthLabel(month: number, year?: number | null) {
  if (month === months.ADAR_I) {
    return year && isHebrewLeapYear(year) ? "אדר א׳" : "אדר";
  }
  if (month === months.ADAR_II) return "אדר ב׳";
  return HEBREW_MONTH_OPTIONS.find((item) => item.month === month)?.label ?? String(month);
}

export function parseHebrewMonth(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 13) return raw;
  const text = String(raw ?? "")
    .trim()
    .replace(/['׳"]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    return n >= 1 && n <= 13 ? n : null;
  }
  return MONTH_ALIASES[text] ?? null;
}

export function gregorianToHebrew(isoDate: string, bornAfterSunset: boolean): HebrewBirthDate | null {
  const parsed = parseIsoDate(isoDate);
  if (!parsed || !isIsoDate(isoDate)) return null;
  const shifted = bornAfterSunset ? shiftCivilDays(parsed.year, parsed.month, parsed.day, 1) : parsed;
  const hd = new HDate(civilNoon(shifted.year, shifted.month, shifted.day));
  return { year: hd.getFullYear(), month: hd.getMonth(), day: hd.getDate() };
}

export function hebrewToGregorian(hebrew: HebrewBirthDate, bornAfterSunset: boolean): string | null {
  if (!isValidHebrewDate(hebrew)) return null;
  const hd = new HDate(hebrew.day, hebrew.month, hebrew.year);
  const g = hd.greg();
  const civil = { year: g.getFullYear(), month: g.getMonth() + 1, day: g.getDate() };
  const shifted = bornAfterSunset ? shiftCivilDays(civil.year, civil.month, civil.day, -1) : civil;
  return formatIsoDate(shifted.year, shifted.month, shifted.day);
}

export function isValidHebrewDate(hebrew: HebrewBirthDate): boolean {
  const { year, month, day } = hebrew;
  if (!Number.isInteger(year) || year < 5000 || year > 6000) return false;
  if (!Number.isInteger(month) || month < 1 || month > 13) return false;
  if (!Number.isInteger(day) || day < 1 || day > 30) return false;
  if (month === months.ADAR_II && !isHebrewLeapYear(year)) return false;
  try {
    const probe = new HDate(1, month, year);
    if (probe.getMonth() !== month || probe.getFullYear() !== year) return false;
    if (day > probe.daysInMonth()) return false;
    const hd = new HDate(day, month, year);
    return hd.getFullYear() === year && hd.getMonth() === month && hd.getDate() === day;
  } catch {
    return false;
  }
}

export function hebrewMonthsForYear(year: number | null | undefined) {
  const leap = typeof year === "number" && isHebrewLeapYear(year);
  return HEBREW_MONTH_OPTIONS.filter((item) => !item.leapOnly || leap).map((item) => ({
    month: item.month,
    label: item.month === months.ADAR_I && leap ? "אדר א׳" : item.month === months.ADAR_I ? "אדר" : item.label
  }));
}

const GERESH = "׳";
const GERSHAYIM = "״";

const GEMATRIA_ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const GEMATRIA_TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const GEMATRIA_HUNDREDS = ["", "ק", "ר", "ש", "ת"];
const GEMATRIA_VALUES: Record<string, number> = {
  א: 1,
  ב: 2,
  ג: 3,
  ד: 4,
  ה: 5,
  ו: 6,
  ז: 7,
  ח: 8,
  ט: 9,
  י: 10,
  כ: 20,
  ך: 20,
  ל: 30,
  מ: 40,
  ם: 40,
  נ: 50,
  ן: 50,
  ס: 60,
  ע: 70,
  פ: 80,
  ף: 80,
  צ: 90,
  ץ: 90,
  ק: 100,
  ר: 200,
  ש: 300,
  ת: 400
};

/** מספר עברי עם גרש/גרשיים: א׳, י״א, ט״ו, ל׳, תשפ״ו */
export function formatHebrewGematria(value: number): string {
  if (!Number.isInteger(value) || value <= 0) return "";
  let n = value;
  const parts: string[] = [];
  while (n >= 400) {
    parts.push("ת");
    n -= 400;
  }
  if (n >= 100) {
    parts.push(GEMATRIA_HUNDREDS[Math.floor(n / 100)] ?? "");
    n %= 100;
  }
  if (n === 15) {
    parts.push("טו");
  } else if (n === 16) {
    parts.push("טז");
  } else {
    if (n >= 10) {
      parts.push(GEMATRIA_TENS[Math.floor(n / 10)] ?? "");
      n %= 10;
    }
    if (n > 0) parts.push(GEMATRIA_ONES[n] ?? "");
  }
  const raw = parts.join("");
  if (!raw) return "";
  if (raw.length === 1) return `${raw}${GERESH}`;
  return `${raw.slice(0, -1)}${GERSHAYIM}${raw.slice(-1)}`;
}

export function hebrewDayLetters(day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 30) return "";
  return formatHebrewGematria(day);
}

/** שנת ה׳אלפים כפי שכותבים בטופס: תשפ״ו, לא 5786 */
export function hebrewYearLetters(year: number): string {
  if (!Number.isInteger(year) || year < 1) return "";
  const withinMillennium = year >= 5000 && year < 6000 ? year % 1000 : year;
  return formatHebrewGematria(withinMillennium);
}

export function parseHebrewGematria(raw: string | number | null | undefined): number {
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) return raw;
  const text = String(raw ?? "").trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) return Number(text);
  let sum = 0;
  for (const ch of text) {
    const value = GEMATRIA_VALUES[ch];
    if (value) sum += value;
  }
  return sum;
}

export function parseHebrewDayInput(raw: string | number | null | undefined): number {
  const n = parseHebrewGematria(raw);
  return n >= 1 && n <= 30 ? n : 0;
}

export function parseHebrewYearInput(raw: string | number | null | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n >= 5000 && n <= 6000) return n;
    if (n >= 1 && n < 1000) return 5000 + n;
    return 0;
  }
  const text = String(raw ?? "")
    .trim()
    .replace(/^ה['׳]\s*/, "")
    .replace(/^ה(?=[א-ת])/, "");
  if (!text) return 0;
  if (/^\d{4,}$/.test(text)) {
    const n = Number(text);
    return n >= 5000 && n <= 6000 ? n : 0;
  }
  if (/^\d{1,3}$/.test(text)) {
    const n = Number(text);
    return n >= 1 ? 5000 + n : 0;
  }
  const n = parseHebrewGematria(text);
  if (n >= 5000 && n <= 6000) return n;
  if (n >= 1 && n < 1000) return 5000 + n;
  return 0;
}

export function formatHebrewDate(hebrew: HebrewBirthDate) {
  const day = hebrewDayLetters(hebrew.day) || String(hebrew.day);
  const year = hebrewYearLetters(hebrew.year) || String(hebrew.year);
  return `${day} ${hebrewMonthLabel(hebrew.month, hebrew.year)} ${year}`;
}
