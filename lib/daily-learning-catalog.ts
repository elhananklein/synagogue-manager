/**
 * קטלוג ספרי הלימוד היומי (מפתחות Hebcal) עם תוויות בעברית.
 * הסדר כאן קובע את סדר ההצגה במסך הלימוד היומי.
 */
export type DailyLearningCatalogEntry = { id: string; title: string };

export const DAILY_LEARNING_CATALOG: DailyLearningCatalogEntry[] = [
  { id: "nachyomi", title: 'נ"ך יומי' },
  { id: "tanakhYomi", title: 'תנ"ך יומי (חלוקת סדרים)' },
  { id: "dailyPsalms", title: "תהילים יומי" },
  { id: "dafyomi", title: "דף יומי" },
  { id: "mishnayomi", title: "משנה יומי" },
  { id: "perekYomi", title: "פרק יומי" },
  { id: "yerushalmi-vilna", title: "ירושלמי יומי (וילנא)" },
  { id: "yerushalmi-schottenstein", title: "ירושלמי יומי (שוטנשטיין)" },
  { id: "dirshuAmudYomi", title: "עמוד היומי (דרשו)" },
  { id: "dafWeekly", title: "דף בשבוע" },
  { id: "dailyRambam1", title: 'רמב"ם — פרק יומי' },
  { id: "dailyRambam3", title: 'רמב"ם — שלושה פרקים' },
  { id: "seferHaMitzvot", title: "ספר המצוות" },
  { id: "arukhHaShulchanYomi", title: "ערוך השולחן יומי" },
  { id: "kitzurShulchanAruch", title: "קיצור שולחן ערוך יומי" },
  { id: "chofetzChaim", title: "חפץ חיים יומי" },
  { id: "shemiratHaLashon", title: "שמירת הלשון יומי" }
];

/** ברירת מחדל: כל הספרים, כמו היום לפני שהגבאי בחר. */
export const DEFAULT_DAILY_LEARNING_KEYS: string[] = DAILY_LEARNING_CATALOG.map((entry) => entry.id);

const KNOWN_KEYS = new Set(DEFAULT_DAILY_LEARNING_KEYS);

/**
 * מנקה רשימת מפתחות מה־DB / מהלקוח.
 *   - קלט שאינו מערך (כולל NULL) → `null` = לא הוגדר, להשתמש בברירת מחדל.
 *   - מערך (גם ריק) → בחירה מפורשת.
 */
export function sanitizeDailyLearningKeys(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const key = typeof item === "string" ? item.trim() : "";
    if (!key || !KNOWN_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function resolveDailyLearningKeys(raw: unknown): string[] {
  return sanitizeDailyLearningKeys(raw) ?? [...DEFAULT_DAILY_LEARNING_KEYS];
}

export function filterDailyLearningByKeys<T extends { id: string }>(items: T[], keys: string[]): T[] {
  const allowed = new Set(keys);
  const order = new Map(DAILY_LEARNING_CATALOG.map((entry, index) => [entry.id, index]));
  return items
    .filter((item) => allowed.has(item.id))
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}
