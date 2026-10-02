import type { AliyahDayKind, AliyahExpectedTribe } from "@/lib/aliyah-types";

export const CHIYUV_KINDS = [
  "chatan",
  "bar_mitzvah",
  "father_of_baby",
  "yahrzeit_parent",
  "bar_mitzvah_father",
  "yahrzeit_other",
  "guest",
  "other"
] as const;
export type ChiyuvKind = (typeof CHIYUV_KINDS)[number];

export const CHIYUV_KIND_LABELS: Record<ChiyuvKind, string> = {
  chatan: "חתן",
  bar_mitzvah: "בר מצווה",
  father_of_baby: "אבי הבן / הבת",
  yahrzeit_parent: "יארצייט לאב או לאם",
  bar_mitzvah_father: "אבי בר המצווה",
  yahrzeit_other: "יארצייט לקרוב אחר",
  guest: "אורח",
  other: "חיוב אחר"
};

export const MANUAL_CHIYUV_KINDS = ["chatan", "bar_mitzvah", "father_of_baby", "guest", "other"] as const;
export type ManualChiyuvKind = (typeof MANUAL_CHIYUV_KINDS)[number];

export function isManualChiyuvKind(value: unknown): value is ManualChiyuvKind {
  return MANUAL_CHIYUV_KINDS.includes(value as ManualChiyuvKind);
}

export type YahrzeitTiming = "shabbat_before" | "shabbat_of_week";
export type YahrzeitScope = "parents" | "all";

export type AliyahPlanSettings = {
  yahrzeitTiming: YahrzeitTiming;
  yahrzeitScope: YahrzeitScope;
  maftirForYahrzeit: boolean;
  maftirForBarMitzvah: boolean;
  separateRelatives: boolean;
  extraAliyotForChiyuvim: boolean;
  backupsCount: number;
  minWeeksBetween: number;
  priorityOrder: ChiyuvKind[];
  emailEnabled: boolean;
  emailRecipients: string;
};

export const DEFAULT_ALIYAH_PLAN_SETTINGS: AliyahPlanSettings = {
  yahrzeitTiming: "shabbat_before",
  yahrzeitScope: "all",
  maftirForYahrzeit: true,
  maftirForBarMitzvah: true,
  separateRelatives: true,
  extraAliyotForChiyuvim: true,
  backupsCount: 2,
  minWeeksBetween: 3,
  priorityOrder: [...CHIYUV_KINDS],
  emailEnabled: true,
  emailRecipients: ""
};

export function normalizePriorityOrder(raw: unknown): ChiyuvKind[] {
  const list = Array.isArray(raw) ? raw.filter((item): item is ChiyuvKind => CHIYUV_KINDS.includes(item as ChiyuvKind)) : [];
  const unique = [...new Set(list)];
  for (const kind of CHIYUV_KINDS) if (!unique.includes(kind)) unique.push(kind);
  return unique;
}

export function normalizeAliyahPlanSettings(raw: Partial<AliyahPlanSettings> | null | undefined): AliyahPlanSettings {
  const base = DEFAULT_ALIYAH_PLAN_SETTINGS;
  if (!raw) return { ...base, priorityOrder: [...base.priorityOrder] };
  const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    yahrzeitTiming: raw.yahrzeitTiming === "shabbat_of_week" ? "shabbat_of_week" : "shabbat_before",
    yahrzeitScope: raw.yahrzeitScope === "parents" ? "parents" : "all",
    maftirForYahrzeit: raw.maftirForYahrzeit ?? base.maftirForYahrzeit,
    maftirForBarMitzvah: raw.maftirForBarMitzvah ?? base.maftirForBarMitzvah,
    separateRelatives: raw.separateRelatives ?? base.separateRelatives,
    extraAliyotForChiyuvim: raw.extraAliyotForChiyuvim ?? base.extraAliyotForChiyuvim,
    backupsCount: clampInt(raw.backupsCount, 0, 3, base.backupsCount),
    minWeeksBetween: clampInt(raw.minWeeksBetween, 0, 26, base.minWeeksBetween),
    priorityOrder: normalizePriorityOrder(raw.priorityOrder),
    emailEnabled: raw.emailEnabled ?? base.emailEnabled,
    emailRecipients: typeof raw.emailRecipients === "string" ? raw.emailRecipients.trim() : ""
  };
}

export type ManualChiyuvEvent = {
  id: string;
  congregantId: string;
  serviceDate: string;
  kind: ManualChiyuvKind;
  preferredSlot: string | null;
  notes: string;
};

export type AliyahPlanCandidate = {
  congregantId: string;
  reason: string;
  chiyuv: ChiyuvKind | null;
};

export type AliyahPlanSlot = {
  key: string;
  label: string;
  expectedTribe: AliyahExpectedTribe;
  extra?: boolean;
  primary: AliyahPlanCandidate | null;
  backups: AliyahPlanCandidate[];
  locked: boolean;
  note: string | null;
};

export type AliyahPlanChiyuvNote = {
  congregantId: string;
  name: string;
  reason: string;
  kind: ChiyuvKind;
};

export type AliyahPlanHashkava = {
  congregantId: string;
  congregantName: string;
  relationLabel: string;
  personName: string;
  dateLabel: string;
};

export type AliyahPlan = {
  minyanId: string;
  serviceDate: string;
  kind: AliyahDayKind;
  title: string;
  hebrewDate: string;
  civilDate: string;
  slots: AliyahPlanSlot[];
  unplaced: AliyahPlanChiyuvNote[];
  hashkavot: AliyahPlanHashkava[];
  saved: boolean;
  savedAt: string | null;
  emailedAt: string | null;
};

export type AliyahPlanSlotInput = {
  slotKey: string;
  sortOrder: number;
  locked: boolean;
  candidates: Array<{ congregantId: string | null; reason: string }>;
};
