export const HAFTARAH_MINHAGIM = ["ashkenazi", "sephardi", "chabad"] as const;

export type HaftarahMinhag = (typeof HAFTARAH_MINHAGIM)[number];

export const DEFAULT_HAFTARAH_MINHAG: HaftarahMinhag = "ashkenazi";

export const HAFTARAH_MINHAG_LABELS: Record<HaftarahMinhag, string> = {
  ashkenazi: "אשכנזי",
  sephardi: "ספרדי",
  chabad: 'חב"ד'
};

/** תווית לנוסח התפילה של המניין — אותן אפשרויות שמניעות הפטרה וברכת השנים. */
export const PRAYER_NUSACH_LABELS = HAFTARAH_MINHAG_LABELS;

export function isHaftarahMinhag(value: string | null | undefined): value is HaftarahMinhag {
  return HAFTARAH_MINHAGIM.includes(value as HaftarahMinhag);
}

export function resolveHaftarahMinhag(raw?: string | null): HaftarahMinhag {
  return isHaftarahMinhag(raw) ? raw : DEFAULT_HAFTARAH_MINHAG;
}

/** נוסח ספרדי נקבע לפי נוסח המניין. חב״ד ואשכנז — נוסח אשכנזי. */
export function isSephardiNusach(minhag?: string | null): boolean {
  return resolveHaftarahMinhag(minhag) === "sephardi";
}

/** תוספת ברכת השנים לתצוגה: אשכנז «ותן ברכה» / ספרד «ברכנו» ו«ברך עלינו». */
export function birkatHashanimLabel(winter: boolean, minhag?: string | null): string {
  if (isSephardiNusach(minhag)) {
    return winter ? "ברך עלינו" : "ברכנו";
  }
  return winter ? "ותן טל ומטר לברכה" : "ותן ברכה";
}
