/**
 * קטלוג הזמנים ההלכתיים שהמערכת מכירה (מפתחות Hebcal) עם תוויות בעברית.
 * משמש גם בממשק הגבאי (בחירת אילו זמנים להציג) וגם בבניית התצוגה.
 * הסדר כאן קובע את סדר ההצגה בלוח "זמני היום ותפילות".
 */
export type ZmanCatalogEntry = { key: string; label: string };

export const ZMANIM_CATALOG: ZmanCatalogEntry[] = [
  { key: "chatzotNight", label: "חצות הלילה" },
  { key: "alotHaShachar", label: "עלות השחר" },
  { key: "misheyakir", label: "משיכיר" },
  { key: "sunrise", label: "הנץ החמה" },
  { key: "sofZmanShmaMGA", label: "סוף זמן ק״ש (מג״א)" },
  { key: "sofZmanShma", label: "סוף זמן קריאת שמע (גר״א)" },
  { key: "sofZmanTfilla", label: "סוף זמן תפילה (גר״א)" },
  { key: "chatzot", label: "חצות היום" },
  { key: "minchaGedola", label: "מנחה גדולה" },
  { key: "minchaKetana", label: "מנחה קטנה" },
  { key: "plagHaMincha", label: "פלג המנחה" },
  { key: "sunset", label: "שקיעה" },
  { key: "tzeit85deg", label: "צאת הכוכבים" },
  { key: "tzeit72min", label: "צאת הכוכבים (ר״ת)" }
];

/** ברירת המחדל לתצוגה — נשמרת על ההתנהגות ההיסטורית (7 הזמנים המקוריים). */
export const DEFAULT_SCHEDULE_ZMANIM_KEYS: string[] = [
  "alotHaShachar",
  "sunrise",
  "sofZmanShma",
  "chatzot",
  "minchaGedola",
  "sunset",
  "tzeit85deg"
];

const KNOWN_ZMAN_KEYS = new Set(ZMANIM_CATALOG.map((entry) => entry.key));

/** תווית עברית לפי מפתח זמן, או המפתח עצמו אם אינו מוכר. */
export function zmanLabelForKey(key: string): string {
  return ZMANIM_CATALOG.find((entry) => entry.key === key)?.label ?? key;
}

/**
 * מנקה רשימת מפתחות שהתקבלה (מה־DB / מהלקוח): משאיר רק מפתחות מוכרים, ללא כפילויות.
 * מבחין בין "לא הוגדר" ל"נבחרו אפס זמנים":
 *   - קלט שאינו מערך (כולל NULL) → `null` = "לא הוגדר → השתמש בברירת מחדל".
 *   - מערך (גם ריק) → מערך מנוקה (ייתכן ריק) = בחירה מפורשת שנשמרת כמות שהיא.
 */
export function sanitizeScheduleZmanimKeys(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const key = item.trim();
    if (!KNOWN_ZMAN_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(key);
  }
  return cleaned;
}

/**
 * מחזיר את רשימת המפתחות לתצוגה בפועל בסדר הקטלוג.
 * `null`/`undefined` = לא הוגדר → ברירת מחדל; מערך ריק = במפורש ללא זמני יום.
 */
export function resolveScheduleZmanimKeys(keys: string[] | null | undefined): string[] {
  const source = keys == null ? DEFAULT_SCHEDULE_ZMANIM_KEYS : keys;
  const selected = new Set(source);
  return ZMANIM_CATALOG.filter((entry) => selected.has(entry.key)).map((entry) => entry.key);
}
