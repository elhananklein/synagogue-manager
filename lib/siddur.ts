import { prayerDisplayGroupId } from "@/lib/prayer-display-groups";
import {
  PRAYER_NUSACH_LABELS,
  resolveHaftarahMinhag,
  type HaftarahMinhag
} from "@/lib/haftarah-minhag";

export const SIDDUR_PRAYERS = ["shacharit", "mincha", "maariv"] as const;
export type SiddurPrayer = (typeof SIDDUR_PRAYERS)[number];

export const SIDDUR_PRAYER_LABELS: Record<SiddurPrayer, string> = {
  shacharit: "שחרית",
  mincha: "מנחה",
  maariv: "ערבית"
};

export type SiddurBookSpec = {
  book: string;
  path: string[];
};

export type SiddurSection = {
  title: string;
  html: string;
};

export type SiddurContent = {
  prayer: SiddurPrayer;
  prayerLabel: string;
  nusach: HaftarahMinhag;
  nusachLabel: string;
  note: string | null;
  sourceLabel: string;
  sourceUrl: string;
  sections: SiddurSection[];
};

const DEDICATED_SERVICE =
  /מוסף|קבלת שבת|שחרית שבת|מנחה שבת|ערבית שבת|שחרית חג|מנחה חג|ערבית חג|מוצאי|מוצ״ש|מוצ"ש/;

export function isSiddurPrayer(value: string | null | undefined): value is SiddurPrayer {
  return SIDDUR_PRAYERS.includes(value as SiddurPrayer);
}

/** תפילות חול שבהן יש נוסח בסידור — לא סליחות, לא מוסף, לא שבת/חג. */
export function siddurPrayerFromLabel(label: string, prayerType?: string | null): SiddurPrayer | null {
  const haystack = `${prayerType ?? ""} ${label}`;
  if (DEDICATED_SERVICE.test(haystack)) return null;
  const group = prayerDisplayGroupId({ label, prayerType });
  if (group === "שחרית") return "shacharit";
  if (group === "מנחה") return "mincha";
  if (group === "ערבית") return "maariv";
  return null;
}

export function siddurNusachLabel(nusach: HaftarahMinhag): string {
  return PRAYER_NUSACH_LABELS[resolveHaftarahMinhag(nusach)];
}

export function siddurNusachNote(nusach: HaftarahMinhag): string | null {
  if (resolveHaftarahMinhag(nusach) === "chabad") {
    return "נוסח חב״ד מוצג לפי סידור ספרד — סידור תהילת ה׳ אינו זמין במקור זה.";
  }
  return null;
}

export function siddurBookSpec(nusach: HaftarahMinhag, prayer: SiddurPrayer): SiddurBookSpec {
  const resolved = resolveHaftarahMinhag(nusach);
  if (resolved === "sephardi") {
    return {
      book: "Siddur Edot HaMizrach",
      path:
        prayer === "shacharit"
          ? ["Weekday Shacharit"]
          : prayer === "mincha"
            ? ["Weekday Mincha"]
            : ["Weekday Arvit"]
    };
  }
  if (resolved === "chabad") {
    return {
      book: "Siddur Sefard",
      path:
        prayer === "shacharit"
          ? ["Weekday Shacharit"]
          : prayer === "mincha"
            ? ["Weekday Mincha"]
            : ["Weekday Maariv"]
    };
  }
  return {
    book: "Siddur Ashkenaz",
    path:
      prayer === "shacharit"
        ? ["Weekday", "Shacharit"]
        : prayer === "mincha"
          ? ["Weekday", "Minchah"]
          : ["Weekday", "Maariv"]
  };
}
