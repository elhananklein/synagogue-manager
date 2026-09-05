import {
  congregantDisplayName,
  congregantPrayerName,
  isCongregantTribe,
  type CongregantRecord,
  type CongregantRegistrationStatus,
  type CongregantTribe
} from "@/lib/congregant-types";

export const ALIYAH_SERVICE_KEY = "shacharit" as const;
export type AliyahServiceKey = typeof ALIYAH_SERVICE_KEY;

export const ALIYAH_DAY_KINDS = ["shabbat", "yom-tov", "yom-kippur", "other"] as const;
export type AliyahDayKind = (typeof ALIYAH_DAY_KINDS)[number];

export const ALIYAH_DAY_KIND_LABELS: Record<AliyahDayKind, string> = {
  shabbat: "שבת",
  "yom-tov": "יום טוב",
  "yom-kippur": "יום כיפור",
  other: "יום אחר"
};

export type AliyahExpectedTribe = CongregantTribe | null;

export type AliyahSlotDef = {
  key: string;
  label: string;
  expectedTribe: AliyahExpectedTribe;
  extra?: boolean;
};

export type AliyahNoKohenResolution = "yisrael" | "skip";

export type AliyahSlotState = AliyahSlotDef & {
  congregantId: string | null;
  noKohenResolution: AliyahNoKohenResolution | null;
  notes: string;
};

export type AliyahCongregantOption = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  displayName: string;
  prayerName: string;
  tribe: CongregantTribe;
  minyanId: string | null;
  minyanName: string | null;
  phone: string;
  isActive: boolean;
  receivesAliyah: boolean;
  registrationStatus: CongregantRegistrationStatus;
};

export type AliyahSheet = {
  minyanId: string;
  serviceDate: string;
  serviceKey: AliyahServiceKey;
  hebrewDate: string;
  parashaLabel: string;
  weekday: string;
  kind: AliyahDayKind;
  isKriahDay: boolean;
  slots: AliyahSlotState[];
};

export type AliyahAssignmentInput = {
  slotKey: string;
  sortOrder: number;
  congregantId: string | null;
  noKohenResolution: AliyahNoKohenResolution | null;
  notes: string;
};

export function toAliyahCongregantOption(row: CongregantRecord): AliyahCongregantOption {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    nickname: row.nickname,
    displayName: congregantDisplayName(row),
    prayerName: congregantPrayerName(row),
    tribe: isCongregantTribe(row.tribe) ? row.tribe : "yisrael",
    minyanId: row.minyanId,
    minyanName: row.minyanName,
    phone: row.phone,
    isActive: row.isActive,
    receivesAliyah: row.receivesAliyah,
    registrationStatus: row.registrationStatus
  };
}
