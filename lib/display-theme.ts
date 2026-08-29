/** סגנון = פריסה ומבנה. פלטה = צבעים בלבד, בלי לשנות את הקיימים. */

export const DISPLAY_STYLES = [
  "classic",
  "modern",
  "minimal",
  "woodSilver",
  "royalBlue",
  "veryBold"
] as const;

export type DisplayStyle = (typeof DISPLAY_STYLES)[number];

export const DISPLAY_PALETTES = [
  { id: "inkIvory", label: "דיו ושנהב" },
  { id: "azureGold", label: "כחול וזהב" },
  { id: "classicBurgundy", label: "בורדו קלאסי" }
] as const;

export type DisplayPalette = (typeof DISPLAY_PALETTES)[number]["id"];

export const DEFAULT_DISPLAY_PALETTE: DisplayPalette = "inkIvory";

export const DISPLAY_STYLE_LABELS: Record<DisplayStyle, string> = {
  classic: "קלאסי",
  modern: "מודרני",
  minimal: "מינימלי",
  woodSilver: "עץ וכסף",
  royalBlue: "כחול מלכותי",
  veryBold: "בולט מאוד"
};

export function isDisplayStyle(value: string | null | undefined): value is DisplayStyle {
  return DISPLAY_STYLES.includes(value as DisplayStyle);
}

export function isDisplayPalette(value: string | null | undefined): value is DisplayPalette {
  return DISPLAY_PALETTES.some((item) => item.id === value);
}

/** אילו סגנונות קוראים פלטה. בהמשך אפשר להדליק גם לאחרים בלי לשנות פריסה. */
export function styleUsesPalettes(style: DisplayStyle): boolean {
  return style === "veryBold";
}

export function resolveDisplayPalette(style: DisplayStyle, raw?: string | null): DisplayPalette {
  if (!styleUsesPalettes(style)) return DEFAULT_DISPLAY_PALETTE;
  return isDisplayPalette(raw) ? raw : DEFAULT_DISPLAY_PALETTE;
}

export function normalizeDisplayStyle(raw?: string | null): DisplayStyle {
  return isDisplayStyle(raw) ? raw : "classic";
}
