export const HALACHA_SOURCE_KEYS = ["manual", "kitzur_shulchan_arukh", "yalkut_yosef", "sefaria_halacha_yomit"] as const;
export type HalachaSourceKey = (typeof HALACHA_SOURCE_KEYS)[number];

export function isHalachaSourceKey(value: unknown): value is HalachaSourceKey {
  return typeof value === "string" && (HALACHA_SOURCE_KEYS as readonly string[]).includes(value);
}

export function isLiveHalachaSource(value: string): boolean {
  return value === "yalkut_yosef" || value === "sefaria_halacha_yomit";
}

export function resolveHalachaSourceKey(value: unknown): HalachaSourceKey {
  return isHalachaSourceKey(value) ? value : "manual";
}

export function halachaSourceLabel(sourceKey: string): string {
  if (sourceKey === "manual") return "ידני";
  if (sourceKey === "kitzur_shulchan_arukh") return "קיצור שולחן ערוך";
  if (sourceKey === "yalkut_yosef" || sourceKey === "sefaria_halacha_yomit") return "שולחן ערוך";
  return "מקור פנימי";
}
