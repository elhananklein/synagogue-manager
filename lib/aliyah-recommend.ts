import { HDate, HebrewCalendar } from "@hebcal/core";
import {
  addDaysIso,
  aliyahDayMeta,
  extraAliyahSlot,
  formatAliyahCivilDate,
  nextExtraAliyahSlot,
  parseExtraSlotKey,
  saturdayOnOrAfter,
  saturdayOnOrBefore
} from "@/lib/aliyah-slots";
import {
  CHIYUV_KIND_LABELS,
  type AliyahPlan,
  type AliyahPlanCandidate,
  type AliyahPlanChiyuvNote,
  type AliyahPlanHashkava,
  type AliyahPlanSettings,
  type AliyahPlanSlot,
  type ChiyuvKind,
  type ManualChiyuvEvent
} from "@/lib/aliyah-plan-types";
import type { AliyahSlotDef } from "@/lib/aliyah-types";
import {
  YAHRZEIT_RELATION_LABELS,
  type CongregantGender,
  type CongregantTribe,
  type CongregantYahrzeit,
  type FamilyRelation
} from "@/lib/congregant-types";
import {
  gregorianToHebrew,
  hebrewDayLetters,
  hebrewMonthLabel,
  isValidHebrewDate,
  parseIsoDate,
  type HebrewBirthDate
} from "@/lib/hebrew-civil-date";

export type RecommendPerson = {
  id: string;
  displayName: string;
  tribe: CongregantTribe;
  gender: CongregantGender;
  minyanId: string | null;
  isActive: boolean;
  receivesAliyah: boolean;
  approved: boolean;
  hebrewBirth: HebrewBirthDate | null;
  yahrzeits: CongregantYahrzeit[];
};

export type RecommendRelation = {
  congregantId: string;
  relatedId: string;
  relation: FamilyRelation;
};

export type RecommendHistoryRow = {
  serviceDate: string;
  congregantId: string;
};

export type RecommendInput = {
  minyanId: string;
  serviceDate: string;
  settings: AliyahPlanSettings;
  people: RecommendPerson[];
  relations: RecommendRelation[];
  history: RecommendHistoryRow[];
  events: ManualChiyuvEvent[];
  /** עליות שהגבאי נעל: slotKey → congregantId */
  locked?: Record<string, string>;
};

type Chiyuv = {
  personId: string;
  kind: ChiyuvKind;
  reason: string;
  preferMaftir: boolean;
  preferredSlot: string | null;
};

type WorkingSlot = AliyahSlotDef & {
  primary: AliyahPlanCandidate | null;
  backups: AliyahPlanCandidate[];
  locked: boolean;
  note: string | null;
};

const NEVER_WEEKS = 104;
const RECENT_PENALTY = 1000;

function isoFromHDate(hd: HDate): string {
  const g = hd.greg();
  const m = String(g.getMonth() + 1).padStart(2, "0");
  const d = String(g.getDate()).padStart(2, "0");
  return `${g.getFullYear()}-${m}-${d}`;
}

function hebrewYearOfIso(iso: string): number {
  const parsed = parseIsoDate(iso);
  if (!parsed) return 0;
  return new HDate(new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0)).getFullYear();
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  if (!a || !b) return 0;
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/** תאריכי יום השנה (יארצייט / יום הולדת) בשנים העבריות סביב יום הקריאה. */
function anniversaryIsos(kind: "yahrzeit" | "birthday", original: HebrewBirthDate, serviceIso: string): string[] {
  if (!isValidHebrewDate(original)) return [];
  const source = new HDate(original.day, original.month, original.year);
  const center = hebrewYearOfIso(serviceIso);
  const out: string[] = [];
  for (const hy of [center - 1, center, center + 1]) {
    if (hy <= original.year) continue;
    const hd =
      kind === "yahrzeit"
        ? HebrewCalendar.getYahrzeit(hy, source)
        : HebrewCalendar.getBirthdayOrAnniversary(hy, source);
    if (hd) out.push(isoFromHDate(hd));
  }
  return out;
}

function hebrewDayMonthLabel(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return "";
  const hd = new HDate(new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0));
  return `${hebrewDayLetters(hd.getDate())} ${hebrewMonthLabel(hd.getMonth(), hd.getFullYear())}`;
}

function yahrzeitHebrew(item: CongregantYahrzeit): HebrewBirthDate | null {
  const date = { year: item.hebrewYear, month: item.hebrewMonth, day: item.hebrewDay };
  if (isValidHebrewDate(date)) return date;
  return item.gregorianDate ? gregorianToHebrew(item.gregorianDate, item.afterSunset) : null;
}

function yahrzeitMatchesService(yahrzeitIso: string, serviceIso: string, timing: AliyahPlanSettings["yahrzeitTiming"]) {
  if (yahrzeitIso === serviceIso) return true;
  const target = timing === "shabbat_of_week" ? saturdayOnOrAfter(yahrzeitIso) : saturdayOnOrBefore(yahrzeitIso);
  return target === serviceIso;
}

function barMitzvahIso(person: RecommendPerson): string | null {
  if (!person.hebrewBirth || !isValidHebrewDate(person.hebrewBirth)) return null;
  const source = new HDate(person.hebrewBirth.day, person.hebrewBirth.month, person.hebrewBirth.year);
  const hd = HebrewCalendar.getBirthdayOrAnniversary(person.hebrewBirth.year + 13, source);
  return hd ? isoFromHDate(hd) : null;
}

function isAdultOn(person: RecommendPerson, serviceIso: string): boolean {
  const iso = barMitzvahIso(person);
  return !iso || iso <= serviceIso;
}

function weeksPhrase(weeks: number): string {
  if (weeks <= 1) return "עלה בשבת שעברה";
  if (weeks === 2) return "לא עלה שבועיים";
  if (weeks > 52) return "לא עלה יותר משנה";
  return `לא עלה ${weeks} שבועות`;
}

function isYisraelSlot(slot: AliyahSlotDef) {
  return slot.key !== "maftir" && slot.expectedTribe !== "kohen" && slot.expectedTribe !== "levi";
}

function eligibleFor(person: RecommendPerson, slot: AliyahSlotDef): boolean {
  if (slot.key === "maftir") return true;
  if (slot.expectedTribe === "kohen") return person.tribe === "kohen";
  if (slot.expectedTribe === "levi") return person.tribe === "levi";
  return person.tribe === "yisrael";
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildRelativePairs(relations: RecommendRelation[], genderById: Map<string, CongregantGender>) {
  const childrenOf = new Map<string, Set<string>>();
  for (const row of relations) {
    if (row.relation !== "son") continue;
    if (genderById.get(row.relatedId) !== "male") continue;
    const set = childrenOf.get(row.congregantId) ?? new Set<string>();
    set.add(row.relatedId);
    childrenOf.set(row.congregantId, set);
  }
  const pairs = new Set<string>();
  for (const [parentId, children] of childrenOf) {
    const list = [...children];
    for (const child of list) pairs.add(pairKey(parentId, child));
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) pairs.add(pairKey(list[i]!, list[j]!));
    }
  }
  return { pairs, childrenOf };
}

export function recommendAliyahPlan(input: RecommendInput): AliyahPlan {
  const { serviceDate, settings, minyanId } = input;
  const meta = aliyahDayMeta(serviceDate);
  const byId = new Map(input.people.map((person) => [person.id, person]));
  const genderById = new Map(input.people.map((person) => [person.id, person.gender]));
  const { pairs: relativePairs, childrenOf } = buildRelativePairs(input.relations, genderById);
  const isRelative = (a: string, b: string) => relativePairs.has(pairKey(a, b));

  const lastIso = new Map<string, string>();
  const countYear = new Map<string, number>();
  const yearAgo = addDaysIso(serviceDate, -365);
  for (const row of input.history) {
    if (row.serviceDate >= serviceDate) continue;
    const prev = lastIso.get(row.congregantId);
    if (!prev || row.serviceDate > prev) lastIso.set(row.congregantId, row.serviceDate);
    if (row.serviceDate >= yearAgo) countYear.set(row.congregantId, (countYear.get(row.congregantId) ?? 0) + 1);
  }

  const rotation = (personId: string) => {
    const last = lastIso.get(personId);
    const count = countYear.get(personId) ?? 0;
    if (!last) {
      return { score: NEVER_WEEKS * 10 - count * 4, reason: "עוד לא נרשמה לו עלייה" };
    }
    const weeks = Math.max(0, Math.floor(daysBetween(last, serviceDate) / 7));
    const recent = weeks < settings.minWeeksBetween;
    return {
      score: Math.min(weeks, NEVER_WEEKS) * 10 - count * 4 - (recent ? RECENT_PENALTY : 0),
      reason: weeksPhrase(weeks)
    };
  };

  const inMinyan = (person: RecommendPerson) => person.minyanId === minyanId || person.minyanId == null;
  const pool = input.people.filter(
    (person) =>
      person.gender === "male" &&
      person.isActive &&
      person.approved &&
      person.receivesAliyah &&
      inMinyan(person) &&
      isAdultOn(person, serviceDate)
  );
  const poolIds = new Set(pool.map((person) => person.id));

  const chiyuvByPerson = new Map<string, Chiyuv>();
  const priorityIndex = (kind: ChiyuvKind) => {
    const index = settings.priorityOrder.indexOf(kind);
    return index === -1 ? settings.priorityOrder.length : index;
  };
  const addChiyuv = (chiyuv: Chiyuv) => {
    const person = byId.get(chiyuv.personId);
    if (!person || person.gender !== "male" || !person.isActive) return;
    const existing = chiyuvByPerson.get(chiyuv.personId);
    if (!existing || priorityIndex(chiyuv.kind) < priorityIndex(existing.kind)) {
      chiyuvByPerson.set(chiyuv.personId, chiyuv);
    }
  };

  const hashkavot: AliyahPlanHashkava[] = [];
  for (const person of input.people) {
    if (!person.isActive || !inMinyan(person)) continue;
    for (const item of person.yahrzeits) {
      const hebrew = yahrzeitHebrew(item);
      if (!hebrew) continue;
      const match = anniversaryIsos("yahrzeit", hebrew, serviceDate).find((iso) =>
        yahrzeitMatchesService(iso, serviceDate, settings.yahrzeitTiming)
      );
      if (!match) continue;
      const dateLabel = hebrewDayMonthLabel(match);
      const relationLabel = YAHRZEIT_RELATION_LABELS[item.relation];
      hashkavot.push({
        congregantId: person.id,
        congregantName: person.displayName,
        relationLabel,
        personName: item.personName,
        dateLabel
      });
      const isParent = item.relation === "father" || item.relation === "mother";
      if (!isParent && settings.yahrzeitScope === "parents") continue;
      if (!poolIds.has(person.id)) continue;
      addChiyuv({
        personId: person.id,
        kind: isParent ? "yahrzeit_parent" : "yahrzeit_other",
        reason: `יארצייט ל${relationLabel}${item.personName ? ` ${item.personName}` : ""} · ${dateLabel}`,
        preferMaftir: settings.maftirForYahrzeit,
        preferredSlot: null
      });
    }
  }

  for (const person of input.people) {
    if (person.gender !== "male" || !person.isActive || !inMinyan(person)) continue;
    const iso = barMitzvahIso(person);
    if (!iso) continue;
    const target = saturdayOnOrAfter(iso);
    if (target !== serviceDate && iso !== serviceDate) continue;
    addChiyuv({
      personId: person.id,
      kind: "bar_mitzvah",
      reason: `בר מצווה · ${hebrewDayMonthLabel(iso)}`,
      preferMaftir: settings.maftirForBarMitzvah,
      preferredSlot: null
    });
    for (const [parentId, children] of childrenOf) {
      if (!children.has(person.id)) continue;
      const parent = byId.get(parentId);
      if (!parent || !poolIds.has(parentId)) continue;
      addChiyuv({
        personId: parentId,
        kind: "bar_mitzvah_father",
        reason: `אבי בר המצווה ${person.displayName}`,
        preferMaftir: false,
        preferredSlot: null
      });
    }
  }

  for (const event of input.events) {
    if (event.serviceDate !== serviceDate) continue;
    addChiyuv({
      personId: event.congregantId,
      kind: event.kind,
      reason: `${CHIYUV_KIND_LABELS[event.kind]}${event.notes ? ` · ${event.notes}` : ""}`,
      preferMaftir: event.kind === "bar_mitzvah" && settings.maftirForBarMitzvah,
      preferredSlot: event.preferredSlot
    });
  }

  const slots: WorkingSlot[] = meta.slots.map((slot) => ({
    key: slot.key,
    label: slot.label,
    expectedTribe: slot.expectedTribe,
    extra: slot.extra,
    primary: null,
    backups: [],
    locked: false,
    note: null
  }));
  const used = new Set<string>();

  const candidateFor = (personId: string): AliyahPlanCandidate => {
    const chiyuv = chiyuvByPerson.get(personId);
    if (chiyuv) return { congregantId: personId, reason: chiyuv.reason, chiyuv: chiyuv.kind };
    return { congregantId: personId, reason: rotation(personId).reason, chiyuv: null };
  };

  const addExtraSlot = (def?: AliyahSlotDef) => {
    const extra = def ?? nextExtraAliyahSlot(slots.map((slot) => slot.key));
    const slot: WorkingSlot = { ...extra, primary: null, backups: [], locked: false, note: null };
    slots.push(slot);
    return slot;
  };

  const adjacentRelative = (slot: WorkingSlot, personId: string) => {
    if (!settings.separateRelatives) return false;
    const index = slots.indexOf(slot);
    return [slots[index - 1], slots[index + 1]].some(
      (neighbor) => neighbor?.primary && isRelative(neighbor.primary.congregantId, personId)
    );
  };

  for (const [slotKey, personId] of Object.entries(input.locked ?? {})) {
    if (!personId || used.has(personId) || !byId.has(personId)) continue;
    let slot = slots.find((item) => item.key === slotKey);
    if (!slot) {
      const extraIndex = parseExtraSlotKey(slotKey);
      if (extraIndex == null) continue;
      slot = addExtraSlot(extraAliyahSlot(extraIndex));
    }
    slot.primary = candidateFor(personId);
    slot.locked = true;
    used.add(personId);
  }

  const unplaced: AliyahPlanChiyuvNote[] = [];
  const chiyuvim = [...chiyuvByPerson.values()]
    .filter((item) => !used.has(item.personId))
    .sort(
      (a, b) =>
        priorityIndex(a.kind) - priorityIndex(b.kind) ||
        rotation(b.personId).score - rotation(a.personId).score
    );

  for (const chiyuv of chiyuvim) {
    const person = byId.get(chiyuv.personId);
    if (!person) continue;
    const tryOrder: WorkingSlot[] = [];
    const push = (slot: WorkingSlot | undefined) => {
      if (slot && !tryOrder.includes(slot)) tryOrder.push(slot);
    };
    if (chiyuv.preferredSlot) push(slots.find((slot) => slot.key === chiyuv.preferredSlot));
    if (chiyuv.preferMaftir) push(slots.find((slot) => slot.key === "maftir"));
    if (person.tribe === "kohen") push(slots.find((slot) => slot.key === "kohen"));
    else if (person.tribe === "levi") push(slots.find((slot) => slot.key === "levi"));
    else for (const slot of slots) if (isYisraelSlot(slot)) push(slot);
    push(slots.find((slot) => slot.key === "maftir"));

    const target =
      tryOrder.find((slot) => !slot.primary && eligibleFor(person, slot) && !adjacentRelative(slot, person.id)) ??
      tryOrder.find((slot) => !slot.primary && eligibleFor(person, slot));
    if (target) {
      target.primary = candidateFor(person.id);
      used.add(person.id);
      continue;
    }
    if (meta.kind === "shabbat" && settings.extraAliyotForChiyuvim && person.tribe === "yisrael") {
      const slot = addExtraSlot();
      slot.primary = candidateFor(person.id);
      used.add(person.id);
      continue;
    }
    unplaced.push({ congregantId: person.id, name: person.displayName, reason: chiyuv.reason, kind: chiyuv.kind });
  }

  const ranked = (slot: WorkingSlot, exclude: Set<string>) =>
    pool
      .filter((person) => eligibleFor(person, slot) && !exclude.has(person.id))
      .map((person) => ({ person, score: rotation(person.id).score }))
      .sort((a, b) => b.score - a.score || a.person.displayName.localeCompare(b.person.displayName, "he"))
      .map((item) => item.person);

  for (const slot of slots) {
    if (slot.primary) continue;
    const options = ranked(slot, used);
    const pick = options.find((person) => !adjacentRelative(slot, person.id)) ?? options[0];
    if (!pick) {
      slot.note =
        slot.expectedTribe === "kohen"
          ? "אין כהן ברשימת המניין — ישראל עולה במקום כהן"
          : slot.expectedTribe === "levi"
            ? "אין לוי ברשימת המניין — הכהן עולה שוב במקום לוי"
            : "אין מועמד פנוי ברשימה";
      continue;
    }
    if (adjacentRelative(slot, pick.id)) slot.note = "שימו לב: קרוב משפחה בעלייה סמוכה";
    slot.primary = candidateFor(pick.id);
    used.add(pick.id);
  }

  const unplacedIds = new Set(unplaced.map((item) => item.congregantId));
  const backupUsed = new Set<string>();
  for (const slot of slots) {
    if (settings.backupsCount <= 0) break;
    const exclude = new Set(used);
    const chiyuvFirst = [...unplacedIds]
      .map((id) => byId.get(id))
      .filter((person): person is RecommendPerson => Boolean(person) && eligibleFor(person!, slot) && !exclude.has(person!.id));
    const rest = ranked(slot, exclude).filter((person) => !unplacedIds.has(person.id));
    const ordered = [...chiyuvFirst, ...rest];
    const fresh = ordered.filter((person) => !backupUsed.has(person.id));
    const reused = ordered.filter((person) => backupUsed.has(person.id));
    const chosen = [...fresh, ...reused].slice(0, settings.backupsCount);
    for (const person of chosen) backupUsed.add(person.id);
    slot.backups = chosen.map((person) => candidateFor(person.id));
  }

  const planSlots: AliyahPlanSlot[] = slots.map((slot) => ({
    key: slot.key,
    label: slot.label,
    expectedTribe: slot.expectedTribe,
    extra: slot.extra,
    primary: slot.primary,
    backups: slot.backups,
    locked: slot.locked,
    note: slot.note
  }));

  return {
    minyanId,
    serviceDate,
    kind: meta.kind,
    title: meta.parashaLabel,
    hebrewDate: meta.hebrewDate,
    civilDate: formatAliyahCivilDate(serviceDate),
    slots: planSlots,
    unplaced,
    hashkavot,
    saved: false,
    savedAt: null,
    emailedAt: null
  };
}

/** יום הקריאה הקרוב (שבת או חג) — היום או אחריו. */
export function nextAliyahServiceDate(todayIso: string): string {
  for (let offset = 0; offset <= 8; offset += 1) {
    const iso = addDaysIso(todayIso, offset);
    if (aliyahDayMeta(iso).isKriahDay) return iso;
  }
  return saturdayOnOrAfter(todayIso);
}
