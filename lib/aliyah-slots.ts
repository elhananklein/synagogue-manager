import { getHolidaysOnDate, getSedra, HDate, ParshaEvent, flags } from "@hebcal/core";
import { formatHebrewDate, gregorianToHebrew, isIsoDate, parseIsoDate } from "@/lib/hebrew-civil-date";
import type { AliyahDayKind, AliyahSlotDef, AliyahSlotState } from "@/lib/aliyah-types";

function weekdayLabel(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (date.getUTCDay() === 6) return "שבת";
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "UTC" }).format(date);
}

const KOHEN: AliyahSlotDef = { key: "kohen", label: "כהן", expectedTribe: "kohen" };
const LEVI: AliyahSlotDef = { key: "levi", label: "לוי", expectedTribe: "levi" };
const SHLISHI: AliyahSlotDef = { key: "shlishi", label: "שלישי", expectedTribe: "yisrael" };
const REVII: AliyahSlotDef = { key: "revii", label: "רביעי", expectedTribe: "yisrael" };
const CHAMISHI: AliyahSlotDef = { key: "chamishi", label: "חמישי", expectedTribe: "yisrael" };
const SHISHI: AliyahSlotDef = { key: "shishi", label: "שישי", expectedTribe: "yisrael" };
const SHEVII: AliyahSlotDef = { key: "shevii", label: "שביעי", expectedTribe: "yisrael" };
const MAFTIR: AliyahSlotDef = { key: "maftir", label: "מפטיר", expectedTribe: null };

export const SHABBAT_ALIYAH_SLOTS: AliyahSlotDef[] = [
  KOHEN,
  LEVI,
  SHLISHI,
  REVII,
  CHAMISHI,
  SHISHI,
  SHEVII,
  MAFTIR
];

export const YOM_TOV_ALIYAH_SLOTS: AliyahSlotDef[] = [KOHEN, LEVI, SHLISHI, REVII, CHAMISHI, MAFTIR];

export const YOM_KIPPUR_ALIYAH_SLOTS: AliyahSlotDef[] = [
  KOHEN,
  LEVI,
  SHLISHI,
  REVII,
  CHAMISHI,
  SHISHI,
  MAFTIR
];

const EXTRA_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳", "ט׳", "י׳"];

export function jerusalemTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function addDaysIso(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function saturdayOnOrBefore(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return addDaysIso(isoDate, -((dow + 1) % 7));
}

export function saturdayOnOrAfter(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return addDaysIso(isoDate, (6 - dow + 7) % 7);
}

/** ברירת מחדל לרישום: השבת שכבר הייתה / שמתקיימת היום. */
export function defaultAliyahServiceDate(todayIso = jerusalemTodayIso()) {
  return saturdayOnOrBefore(todayIso);
}

function hdateFromIso(isoDate: string) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return null;
  return new HDate(new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0));
}

function isYomKippurEvent(desc: string, eventFlags: number) {
  if (eventFlags & flags.EREV) return false;
  return desc === "Yom Kippur" || desc.includes("Yom Kippur");
}

export function aliyahDayKind(isoDate: string): AliyahDayKind {
  if (!isIsoDate(isoDate)) return "other";
  const [year, month, day] = isoDate.split("-").map(Number);
  const isShabbat = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay() === 6;
  const hd = hdateFromIso(isoDate);
  if (!hd) return isShabbat ? "shabbat" : "other";
  const events = getHolidaysOnDate(hd, true) ?? [];
  let yomKippur = false;
  let chag = false;
  for (const ev of events) {
    const eventFlags = ev.getFlags();
    if (eventFlags & flags.EREV) continue;
    if (isYomKippurEvent(ev.getDesc(), eventFlags)) yomKippur = true;
    if (eventFlags & flags.CHAG) chag = true;
  }
  if (isShabbat) return "shabbat";
  if (yomKippur) return "yom-kippur";
  if (chag) return "yom-tov";
  return "other";
}

export function slotsForAliyahDay(kind: AliyahDayKind): AliyahSlotDef[] {
  if (kind === "yom-kippur") return YOM_KIPPUR_ALIYAH_SLOTS;
  if (kind === "yom-tov") return YOM_TOV_ALIYAH_SLOTS;
  return SHABBAT_ALIYAH_SLOTS;
}

export function emptySlotState(def: AliyahSlotDef): AliyahSlotState {
  return {
    ...def,
    congregantId: null,
    noKohenResolution: null,
    notes: ""
  };
}

export function extraAliyahSlot(index: number): AliyahSlotDef {
  const n = Math.max(1, Math.floor(index));
  const letter = EXTRA_LETTERS[n - 1] ?? String(n);
  return {
    key: `extra:${n}`,
    label: `הוספה ${letter}`,
    expectedTribe: null,
    extra: true
  };
}

export function nextExtraAliyahSlot(existingKeys: string[]): AliyahSlotDef {
  const nums = existingKeys
    .map((key) => {
      const match = /^extra:(\d+)$/.exec(key);
      return match ? Number(match[1]) : 0;
    })
    .filter((n) => n > 0);
  return extraAliyahSlot(Math.max(0, ...nums) + 1);
}

export function parseExtraSlotKey(key: string) {
  const match = /^extra:(\d+)$/.exec(key);
  return match ? Number(match[1]) : null;
}

export function isAliyahSlotKey(key: string) {
  if (SHABBAT_ALIYAH_SLOTS.some((slot) => slot.key === key)) return true;
  return parseExtraSlotKey(key) != null;
}

export function hebrewDateLabelForIso(isoDate: string) {
  const hebrew = gregorianToHebrew(isoDate, false);
  return hebrew ? formatHebrewDate(hebrew) : "";
}

export function parashaOrChagLabel(isoDate: string, kind: AliyahDayKind) {
  const hd = hdateFromIso(isoDate);
  if (!hd) return "";
  const events = getHolidaysOnDate(hd, true) ?? [];
  const chagTitle =
    events.find((ev) => {
      const eventFlags = ev.getFlags();
      if (eventFlags & flags.EREV) return false;
      return Boolean(eventFlags & flags.CHAG);
    })?.render("he") ?? "";
  if (kind !== "shabbat" && chagTitle) return chagTitle;
  try {
    const lookup = getSedra(hd.getFullYear(), true).lookup(hd);
    if (lookup.chag) return chagTitle || lookup.parsha.join("־");
    return new ParshaEvent(lookup).render("he");
  } catch {
    return chagTitle;
  }
}

export function aliyahDayMeta(isoDate: string) {
  const kind = aliyahDayKind(isoDate);
  return {
    kind,
    isKriahDay: kind !== "other",
    weekday: weekdayLabel(isoDate),
    hebrewDate: hebrewDateLabelForIso(isoDate),
    parashaLabel: parashaOrChagLabel(isoDate, kind),
    slots: slotsForAliyahDay(kind).map(emptySlotState)
  };
}

export function mergeAliyahSlots(base: AliyahSlotState[], saved: AliyahSlotState[]): AliyahSlotState[] {
  const byKey = new Map(saved.map((slot) => [slot.key, slot]));
  const merged = base.map((slot) => {
    const existing = byKey.get(slot.key);
    if (!existing) return slot;
    byKey.delete(slot.key);
    return {
      ...slot,
      congregantId: existing.congregantId,
      noKohenResolution: existing.noKohenResolution,
      notes: existing.notes
    };
  });
  const extras = [...byKey.values()]
    .filter((slot) => parseExtraSlotKey(slot.key) != null)
    .sort((a, b) => (parseExtraSlotKey(a.key) ?? 0) - (parseExtraSlotKey(b.key) ?? 0))
    .map((slot) => {
      const def = extraAliyahSlot(parseExtraSlotKey(slot.key) ?? 1);
      return {
        ...def,
        congregantId: slot.congregantId,
        noKohenResolution: slot.noKohenResolution,
        notes: slot.notes
      };
    });
  return [...merged, ...extras];
}
