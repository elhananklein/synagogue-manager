import * as XLSX from "xlsx";
import {
  completeBirthDates,
  emptyCongregantInput,
  isCongregantTribe,
  normalizePhone,
  parseCongregantTribe,
  validateCongregantInput,
  type CongregantInput,
  type CongregantMinyanOption
} from "@/lib/congregant-types";
import { formatIsoDate, isIsoDate, parseHebrewMonth } from "@/lib/hebrew-civil-date";

export const CONGREGANT_EXCEL_COLUMNS = [
  { key: "firstName", header: "שם פרטי" },
  { key: "middleName", header: "שם שני" },
  { key: "lastName", header: "משפחה" },
  { key: "nickname", header: "כינוי" },
  { key: "fatherName", header: "שם האב" },
  { key: "motherName", header: "שם האם" },
  { key: "tribe", header: "כהן / לוי / ישראל" },
  { key: "minyanName", header: "מניין" },
  { key: "phone", header: "טלפון" },
  { key: "email", header: "מייל" },
  { key: "gregorianBirthDate", header: "תאריך לידה לועזי" },
  { key: "hebrewBirthDay", header: "יום לידה עברי" },
  { key: "hebrewBirthMonth", header: "חודש לידה עברי" },
  { key: "hebrewBirthYear", header: "שנת לידה עברית" },
  { key: "bornAfterSunset", header: "נולד אחרי השקיעה" },
  { key: "isActive", header: "פעיל" },
  { key: "receivesAliyah", header: "עולה לתורה" },
  { key: "notes", header: "הערות" }
] as const;

export type CongregantImportIssue = {
  line: number;
  message: string;
};

export type CongregantImportPreviewRow = {
  line: number;
  input: CongregantInput;
  minyanName: string;
};

const MAX_ROWS = 800;

function normalizeHeader(value: string) {
  return value
    .normalize("NFKC")
    .replace(/^\uFEFF/, "")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "כן" : "לא";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  return String(value).trim();
}

function parseBooleanCell(value: unknown, fallback: boolean): boolean {
  const text = cellText(value).toLowerCase();
  if (!text) return fallback;
  if (["1", "true", "yes", "y", "v", "כן", "כ"].includes(text)) return true;
  if (["0", "false", "no", "n", "לא", "ל"].includes(text)) return false;
  return fallback;
}

function parseGregorianCell(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 20000 && value < 90000) {
    const parsed = XLSX.SSF.parse_date_code(value) as { y?: number; m?: number; d?: number } | null;
    if (parsed?.y && parsed.m && parsed.d) return formatIsoDate(parsed.y, parsed.m, parsed.d);
  }
  const text = cellText(value);
  if (!text) return "";
  if (isIsoDate(text)) return text;
  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const iso = formatIsoDate(year, month, day);
    return isIsoDate(iso) ? iso : text;
  }
  return text;
}

function parseYearCell(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const text = cellText(value).replace(/[^\d]/g, "");
  return text ? Number(text) : 0;
}

function parseDayCell(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const text = cellText(value);
  return text ? Number(text) : 0;
}

function matchMinyan(name: string, minyanim: CongregantMinyanOption[]): CongregantMinyanOption | null {
  const needle = name.trim();
  if (!needle) return minyanim.length === 1 ? minyanim[0] : null;
  const exact = minyanim.find((item) => item.name.trim() === needle);
  if (exact) return exact;
  const lower = needle.toLowerCase();
  const fuzzy = minyanim.filter((item) => item.name.trim().toLowerCase().includes(lower) || lower.includes(item.name.trim().toLowerCase()));
  return fuzzy.length === 1 ? fuzzy[0] : null;
}

export function buildCongregantTemplateWorkbook(minyanim: CongregantMinyanOption[]) {
  const headers = CONGREGANT_EXCEL_COLUMNS.map((col) => col.header);
  const sampleMinyan = minyanim[0]?.name ?? "";
  const sample = [
    "דוד",
    "",
    "כהן",
    "",
    "יעקב",
    "רחל",
    "כהן",
    sampleMinyan,
    "0501234567",
    "",
    "1980-03-15",
    "",
    "",
    "",
    "לא",
    "כן",
    "כן",
    ""
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers, sample]);
  sheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, header.length + 2) }));
  const instructions = [
    ["הוראות למילוי קובץ המתפללים"],
    ["אפשר למלא תאריך לועזי או תאריך עברי (יום + חודש + שנה). השני יחושב אוטומטית."],
    ["שנת לידה חובה תמיד."],
    ["כהן / לוי / ישראל: כהן, לוי או ישראל."],
    ["נולד אחרי השקיעה / פעיל / עולה לתורה: כן או לא."],
    ["מניין: השם כמו במערכת. אם יש מניין אחד בלבד אפשר להשאיר ריק."],
    ["טלפון ייחודי בבית הכנסת. מייל ייחודי אם מולא."],
    [""],
    ["מניינים בבית הכנסת:", minyanim.map((item) => item.name).join(" | ") || "אין עדיין"]
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "מתפללים");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(instructions), "הוראות");
  return book;
}

export function congregantTemplateBuffer(minyanim: CongregantMinyanOption[]) {
  return XLSX.write(buildCongregantTemplateWorkbook(minyanim), { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseCongregantSpreadsheet(
  buffer: Buffer,
  minyanim: CongregantMinyanOption[]
): { rows: CongregantImportPreviewRow[]; issues: CongregantImportIssue[] } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
  const sheetName = workbook.SheetNames.find((name) => name !== "הוראות") ?? workbook.SheetNames[0];
  if (!sheetName) return { rows: [], issues: [{ line: 1, message: "הקובץ ריק" }] };
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
  if (!matrix.length) return { rows: [], issues: [{ line: 1, message: "הקובץ ריק" }] };

  const headerRow = matrix[0].map((cell) => normalizeHeader(cellText(cell)));
  const indexByKey = new Map<string, number>();
  for (const col of CONGREGANT_EXCEL_COLUMNS) {
    const idx = headerRow.findIndex((header) => header === normalizeHeader(col.header));
    if (idx >= 0) indexByKey.set(col.key, idx);
  }
  if (!indexByKey.has("firstName") || !indexByKey.has("lastName")) {
    return { rows: [], issues: [{ line: 1, message: "חסרות עמודות חובה: שם פרטי ומשפחה. הורידו את התבנית ומלאו אותה." }] };
  }

  const minyanIds = new Set(minyanim.map((item) => item.id));
  const rows: CongregantImportPreviewRow[] = [];
  const issues: CongregantImportIssue[] = [];
  const phones = new Map<string, number>();
  const emails = new Map<string, number>();

  const dataRows = matrix.slice(1).filter((line) => line.some((cell) => cellText(cell)));
  if (dataRows.length > MAX_ROWS) {
    issues.push({ line: 1, message: `אפשר לייבא עד ${MAX_ROWS} שורות בקובץ אחד` });
    return { rows: [], issues };
  }

  dataRows.forEach((line, offset) => {
    const excelLine = offset + 2;
    const read = (key: (typeof CONGREGANT_EXCEL_COLUMNS)[number]["key"]) => {
      const idx = indexByKey.get(key);
      return idx == null ? "" : line[idx];
    };
    const minyanName = cellText(read("minyanName"));
    const minyan = matchMinyan(minyanName, minyanim);
    if (minyanName && !minyan) {
      issues.push({ line: excelLine, message: `לא נמצא מניין בשם «${minyanName}»` });
      return;
    }
    const tribeRaw = cellText(read("tribe"));
    const tribe = parseCongregantTribe(tribeRaw) ?? (tribeRaw ? null : "yisrael");
    if (!tribe || !isCongregantTribe(tribe)) {
      issues.push({ line: excelLine, message: "יש למלא כהן, לוי או ישראל" });
      return;
    }
    const hebrewMonthRaw = read("hebrewBirthMonth");
    const input: CongregantInput = {
      ...emptyCongregantInput(minyan?.id ?? null),
      firstName: cellText(read("firstName")),
      middleName: cellText(read("middleName")),
      lastName: cellText(read("lastName")),
      nickname: cellText(read("nickname")),
      fatherName: cellText(read("fatherName")),
      motherName: cellText(read("motherName")),
      tribe,
      gregorianBirthDate: parseGregorianCell(read("gregorianBirthDate")),
      hebrewBirthDay: parseDayCell(read("hebrewBirthDay")),
      hebrewBirthMonth: parseHebrewMonth(typeof hebrewMonthRaw === "number" ? hebrewMonthRaw : cellText(hebrewMonthRaw)) ?? 0,
      hebrewBirthYear: parseYearCell(read("hebrewBirthYear")),
      bornAfterSunset: parseBooleanCell(read("bornAfterSunset"), false),
      phone: cellText(read("phone")),
      email: cellText(read("email")),
      isActive: parseBooleanCell(read("isActive"), true),
      receivesAliyah: parseBooleanCell(read("receivesAliyah"), true),
      notes: cellText(read("notes"))
    };
    if (!input.gregorianBirthDate && input.hebrewBirthMonth === 0) {
      input.hebrewBirthMonth = 7;
    }
    const dates = completeBirthDates(input, input.gregorianBirthDate ? "gregorian" : "hebrew");
    const merged = dates.next;
    const validated = validateCongregantInput(merged, minyanIds);
    if (dates.error || validated.errors.length) {
      issues.push({ line: excelLine, message: (dates.error ? [dates.error] : validated.errors).join("; ") });
      return;
    }
    const phone = normalizePhone(validated.next.phone);
    if (phone) {
      const prev = phones.get(phone);
      if (prev) {
        issues.push({ line: excelLine, message: `טלפון כפול עם שורה ${prev}` });
        return;
      }
      phones.set(phone, excelLine);
    }
    const email = validated.next.email.trim().toLowerCase();
    if (email) {
      const prev = emails.get(email);
      if (prev) {
        issues.push({ line: excelLine, message: `מייל כפול עם שורה ${prev}` });
        return;
      }
      emails.set(email, excelLine);
    }
    rows.push({ line: excelLine, input: validated.next, minyanName: minyan?.name ?? minyanName });
  });

  return { rows, issues };
}
