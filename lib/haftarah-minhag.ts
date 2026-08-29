export const HAFTARAH_MINHAGIM = ["ashkenazi", "sephardi", "chabad"] as const;

export type HaftarahMinhag = (typeof HAFTARAH_MINHAGIM)[number];

export const DEFAULT_HAFTARAH_MINHAG: HaftarahMinhag = "ashkenazi";

export const HAFTARAH_MINHAG_LABELS: Record<HaftarahMinhag, string> = {
  ashkenazi: "אשכנזי",
  sephardi: "ספרדי",
  chabad: 'חב"ד'
};

export function isHaftarahMinhag(value: string | null | undefined): value is HaftarahMinhag {
  return HAFTARAH_MINHAGIM.includes(value as HaftarahMinhag);
}

export function resolveHaftarahMinhag(raw?: string | null): HaftarahMinhag {
  return isHaftarahMinhag(raw) ? raw : DEFAULT_HAFTARAH_MINHAG;
}
