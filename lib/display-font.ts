export const DISPLAY_FONTS = [
  { id: "heebo", label: "ברירת מחדל" },
  { id: "bonaNova", label: "Bona Nova" },
  { id: "david", label: "David" },
  { id: "arial", label: "Arial" }
] as const;

export type DisplayFont = (typeof DISPLAY_FONTS)[number]["id"];

export const DEFAULT_DISPLAY_FONT: DisplayFont = "heebo";

export function isDisplayFont(value: string | null | undefined): value is DisplayFont {
  return DISPLAY_FONTS.some((item) => item.id === value);
}

export function resolveDisplayFont(raw?: string | null): DisplayFont {
  return isDisplayFont(raw) ? raw : DEFAULT_DISPLAY_FONT;
}
