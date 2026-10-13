import {
  CONGREGANT_TRIBE_LABELS,
  congregantDisplayName,
  congregantPrayerName,
  type CongregantRecord
} from "@/lib/congregant-types";
import { formatHebrewDate, isValidHebrewDate } from "@/lib/hebrew-civil-date";

/** רשימת מתפללים לטבלה / אקסל / הדפסה — משותף לדפדפן ולשרת */

export type RosterFilter = {
  minyanId: string | null;
  includeInactive: boolean;
  query: string;
};

export const ROSTER_COLUMNS = [
  { key: "lastName", header: "משפחה" },
  { key: "firstName", header: "שם פרטי" },
  { key: "prayerName", header: "שם לעלייה" },
  { key: "tribe", header: "כהן / לוי / ישראל" },
  { key: "minyan", header: "מניין" },
  { key: "phone", header: "טלפון" },
  { key: "email", header: "מייל" },
  { key: "hebrewBirth", header: "תאריך לידה עברי" },
  { key: "status", header: "מצב" }
] as const;

export type RosterColumnKey = (typeof ROSTER_COLUMNS)[number]["key"];
export type RosterRow = { id: string } & Record<RosterColumnKey, string>;

const collator = new Intl.Collator("he", { sensitivity: "base", numeric: true });

export function filterRoster(rows: CongregantRecord[], filter: RosterFilter): CongregantRecord[] {
  const q = filter.query.trim();
  return rows.filter((row) => {
    if (!filter.includeInactive && !row.isActive) return false;
    if (filter.minyanId && row.minyanId !== filter.minyanId) return false;
    if (!q) return true;
    return `${congregantDisplayName(row)} ${row.nickname} ${row.phone} ${row.email} ${row.fatherName}`.includes(q);
  });
}

/** א-ב לפי שם משפחה, ואז שם פרטי. בלי שם משפחה — בסוף. */
export function sortByLastName(rows: CongregantRecord[]): CongregantRecord[] {
  return [...rows].sort((a, b) => {
    const aLast = a.lastName.trim();
    const bLast = b.lastName.trim();
    if (!aLast !== !bLast) return aLast ? -1 : 1;
    return (
      collator.compare(aLast, bLast) ||
      collator.compare(a.firstName.trim(), b.firstName.trim()) ||
      collator.compare(a.middleName.trim(), b.middleName.trim())
    );
  });
}

function hebrewBirthLabel(row: CongregantRecord) {
  const date = { year: row.hebrewBirthYear, month: row.hebrewBirthMonth, day: row.hebrewBirthDay };
  return isValidHebrewDate(date) ? formatHebrewDate(date) : "";
}

function statusLabel(row: CongregantRecord) {
  if (row.registrationStatus === "pending") return "ממתין לאישור";
  if (!row.isActive) return "לא פעיל";
  return "";
}

export function toRosterRow(row: CongregantRecord): RosterRow {
  return {
    id: row.id,
    lastName: row.lastName.trim(),
    firstName: [row.firstName.trim(), row.middleName.trim()].filter(Boolean).join(" "),
    prayerName: congregantPrayerName(row),
    tribe: CONGREGANT_TRIBE_LABELS[row.tribe] ?? "",
    minyan: row.minyanName ?? "",
    phone: row.phone.trim(),
    email: row.email.trim(),
    hebrewBirth: hebrewBirthLabel(row),
    status: statusLabel(row)
  };
}

/** עמודת מניין רק כשיש יותר ממניין אחד; עמודת מצב רק כשיש בה משהו */
export function rosterColumns(rows: RosterRow[]) {
  const minyanim = new Set(rows.map((row) => row.minyan));
  const hasStatus = rows.some((row) => row.status);
  return ROSTER_COLUMNS.filter(
    (col) => (col.key !== "minyan" || minyanim.size > 1) && (col.key !== "status" || hasStatus)
  );
}

export function buildRoster(rows: CongregantRecord[], filter: RosterFilter) {
  const data = sortByLastName(filterRoster(rows, filter)).map(toRosterRow);
  return { rows: data, columns: rosterColumns(data) };
}

export function rosterQueryString(filter: RosterFilter) {
  const params = new URLSearchParams();
  if (filter.minyanId) params.set("minyanId", filter.minyanId);
  if (filter.includeInactive) params.set("inactive", "1");
  if (filter.query.trim()) params.set("q", filter.query.trim());
  return params.toString();
}

export function rosterFilterFromSearch(params: URLSearchParams): RosterFilter {
  return {
    minyanId: params.get("minyanId")?.trim() || null,
    includeInactive: params.get("inactive") === "1",
    query: params.get("q")?.trim() ?? ""
  };
}
