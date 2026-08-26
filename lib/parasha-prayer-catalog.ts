export const CHOL_HAMOED_PESACH_KEY = "חול המועד פסח";
export const CHOL_HAMOED_SUKKOT_KEY = "חול המועד סוכות";

export const PARASHA_CATALOG_EXTRA_KEYS = [CHOL_HAMOED_PESACH_KEY, CHOL_HAMOED_SUKKOT_KEY] as const;

/** 54 פרשות השבוע — תווית Hebcal (עם «פרשת») וכינויים למיון. */
const TORAH_PARASHOT: { label: string; aliases: string[] }[] = [
  { label: "פרשת בראשית", aliases: ["בראשית"] },
  { label: "פרשת נח", aliases: ["נח"] },
  { label: "פרשת לך־לך", aliases: ["לך-לך", "לך לך"] },
  { label: "פרשת וירא", aliases: ["וירא"] },
  { label: "פרשת חיי שרה", aliases: ["חיי שרה"] },
  { label: "פרשת תולדות", aliases: ["תולדות"] },
  { label: "פרשת ויצא", aliases: ["ויצא"] },
  { label: "פרשת וישלח", aliases: ["וישלח"] },
  { label: "פרשת וישב", aliases: ["וישב"] },
  { label: "פרשת מקץ", aliases: ["מקץ"] },
  { label: "פרשת ויגש", aliases: ["ויגש"] },
  { label: "פרשת ויחי", aliases: ["ויחי"] },
  { label: "פרשת שמות", aliases: ["שמות"] },
  { label: "פרשת וארא", aliases: ["וארא"] },
  { label: "פרשת בא", aliases: ["בא"] },
  { label: "פרשת בשלח", aliases: ["בשלח"] },
  { label: "פרשת יתרו", aliases: ["יתרו"] },
  { label: "פרשת משפטים", aliases: ["משפטים"] },
  { label: "פרשת תרומה", aliases: ["תרומה"] },
  { label: "פרשת תצוה", aliases: ["תצוה"] },
  { label: "פרשת כי תשא", aliases: ["כי תשא", "כי-תשא"] },
  { label: "פרשת ויקהל", aliases: ["ויקהל"] },
  { label: "פרשת פקודי", aliases: ["פקודי"] },
  { label: "פרשת ויקרא", aliases: ["ויקרא"] },
  { label: "פרשת צו", aliases: ["צו"] },
  { label: "פרשת שמיני", aliases: ["שמיני"] },
  { label: "פרשת תזריע", aliases: ["תזריע"] },
  { label: "פרשת מצרע", aliases: ["מצרע", "מצורע"] },
  { label: "פרשת אחרי מות", aliases: ["אחרי מות"] },
  { label: "פרשת קדשים", aliases: ["קדשים", "קדושים"] },
  { label: "פרשת אמור", aliases: ["אמור"] },
  { label: "פרשת בהר", aliases: ["בהר"] },
  { label: "פרשת בחקתי", aliases: ["בחקתי", "בחוקותי", "בחקותי"] },
  { label: "פרשת במדבר", aliases: ["במדבר"] },
  { label: "פרשת נשא", aliases: ["נשא"] },
  { label: "פרשת בהעלתך", aliases: ["בהעלתך", "בהעלותך"] },
  { label: "פרשת שלח־לך", aliases: ["שלח-לך", "שלח לך", "שלח"] },
  { label: "פרשת קורח", aliases: ["קורח", "קרח"] },
  { label: "פרשת חוקת", aliases: ["חוקת", "חקת"] },
  { label: "פרשת בלק", aliases: ["בלק"] },
  { label: "פרשת פינחס", aliases: ["פינחס"] },
  { label: "פרשת מטות", aliases: ["מטות"] },
  { label: "פרשת מסעי", aliases: ["מסעי"] },
  { label: "פרשת דברים", aliases: ["דברים"] },
  { label: "פרשת ואתחנן", aliases: ["ואתחנן"] },
  { label: "פרשת עקב", aliases: ["עקב"] },
  { label: "פרשת ראה", aliases: ["ראה"] },
  { label: "פרשת שופטים", aliases: ["שופטים"] },
  { label: "פרשת כי־תצא", aliases: ["כי-תצא", "כי תצא"] },
  { label: "פרשת כי־תבוא", aliases: ["כי-תבוא", "כי תבוא"] },
  { label: "פרשת נצבים", aliases: ["נצבים", "ניצבים"] },
  { label: "פרשת וילך", aliases: ["וילך"] },
  { label: "פרשת האזינו", aliases: ["האזינו"] },
  { label: "פרשת וזאת הברכה", aliases: ["וזאת הברכה"] }
];

const COMBINED_PARASHOT: { label: string; aliases: string[] }[] = [
  { label: "פרשת ויקהל־פקודי", aliases: ["ויקהל-פקודי"] },
  { label: "פרשת תזריע־מצרע", aliases: ["תזריע-מצרע", "תזריע-מצורע"] },
  { label: "פרשת אחרי מות־קדשים", aliases: ["אחרי מות-קדשים", "אחרי מות-קדושים"] },
  { label: "פרשת בהר־בחקתי", aliases: ["בהר-בחקתי", "בהר-בחוקותי", "בהר-בחקותי"] },
  { label: "פרשת חוקת־בלק", aliases: ["חוקת-בלק", "חקת-בלק"] },
  { label: "פרשת מטות־מסעי", aliases: ["מטות-מסעי"] },
  { label: "פרשת נצבים־וילך", aliases: ["נצבים-וילך", "ניצבים-וילך"] }
];

const TZAV_INDEX = TORAH_PARASHOT.findIndex((item) => item.aliases[0] === "צו");
const HAAZINU_INDEX = TORAH_PARASHOT.findIndex((item) => item.aliases[0] === "האזינו");

function normalizeParashaOrderLabel(raw: string): string {
  return raw
    .replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/^פרשת\s+/, "")
    .replace(/[\u05BE\u2010-\u2015\u2212-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const PARASHA_RANK = (() => {
  const map = new Map<string, number>();
  TORAH_PARASHOT.forEach((item, index) => {
    map.set(normalizeParashaOrderLabel(item.label), index);
    for (const alias of item.aliases) map.set(normalizeParashaOrderLabel(alias), index);
  });
  for (const item of COMBINED_PARASHOT) {
    const normalized = normalizeParashaOrderLabel(item.label);
    const hyphen = normalized.indexOf("-");
    const first = hyphen > 0 ? normalized.slice(0, hyphen).trim() : normalized;
    const rank = (map.get(first) ?? 9_000) + 0.5;
    map.set(normalized, rank);
    for (const alias of item.aliases) map.set(normalizeParashaOrderLabel(alias), rank);
  }
  return map;
})();

function parashaSortRank(key: string): number {
  const normalized = normalizeParashaOrderLabel(key);
  if (!normalized) return 10_000;

  if (
    normalized === CHOL_HAMOED_PESACH_KEY ||
    (normalized.includes("חול המועד") && normalized.includes("פסח"))
  ) {
    return TZAV_INDEX + 0.3;
  }
  if (
    normalized === CHOL_HAMOED_SUKKOT_KEY ||
    (normalized.includes("חול המועד") && (normalized.includes("סוכות") || normalized.includes("סכות")))
  ) {
    return HAAZINU_INDEX + 0.3;
  }

  const exact = PARASHA_RANK.get(normalized);
  if (exact != null) return exact;

  const hyphen = normalized.indexOf("-");
  if (hyphen > 0) {
    const first = normalized.slice(0, hyphen).trim();
    const second = normalized.slice(hyphen + 1).trim();
    const firstIndex = PARASHA_RANK.get(first);
    const secondIndex = PARASHA_RANK.get(second);
    if (firstIndex != null && secondIndex != null && Number.isInteger(firstIndex) && Number.isInteger(secondIndex)) {
      return firstIndex + 0.5;
    }
  }

  return 9_000;
}

export type ParashaPrayerCatalogRow = {
  parashaKey: string;
  minchaTime: string | null;
  maarivTime: string | null;
};

export type ParashaPrayerParseWarning = {
  line: number;
  message: string;
};

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function withParashaCatalogSelectKeys(keys: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const canonical = [
    ...TORAH_PARASHOT.map((item) => item.label),
    ...COMBINED_PARASHOT.map((item) => item.label),
    ...PARASHA_CATALOG_EXTRA_KEYS
  ];
  for (const key of [...canonical, ...keys]) {
    const trimmed = key.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  out.sort((a, b) => {
    const delta = parashaSortRank(a) - parashaSortRank(b);
    if (delta !== 0) return delta;
    return a.localeCompare(b, "he");
  });
  return out;
}

export function normalizeParashaLabel(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/^פרשת\s+/, "")
    .replace(/[־–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeClockTime(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const fraction = raw >= 1 ? raw % 1 : raw;
    if (fraction < 0) return null;
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const hours = raw.getUTCHours();
    const minutes = raw.getUTCMinutes();
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const text = String(raw).replace(/^\uFEFF/, "").trim();
  if (!text) return null;
  const match = TIME_RE.exec(text);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function headerKey(raw: string): "parasha" | "mincha" | "maariv" | null {
  const n = normalizeParashaLabel(raw).replace(/"/g, "").toLowerCase();
  if (!n) return null;
  if (n === "פרשה" || n === "פרשת השבוע" || n === "parasha" || n === "parsha") return "parasha";
  if (n === "מנחה" || n === "mincha") return "mincha";
  if (n === "ערבית" || n === "maariv" || n === "arvith") return "maariv";
  return null;
}

export function parseParashaPrayerTable(
  matrix: unknown[][],
  allowedKeys: string[]
): { rows: ParashaPrayerCatalogRow[]; warnings: ParashaPrayerParseWarning[] } {
  const allowedByNorm = new Map<string, string>();
  for (const key of allowedKeys) {
    allowedByNorm.set(normalizeParashaLabel(key), key);
  }

  const warnings: ParashaPrayerParseWarning[] = [];
  if (!matrix.length) {
    return { rows: [], warnings: [{ line: 1, message: "הקובץ ריק" }] };
  }

  const headerRow = matrix[0] ?? [];
  const col: Partial<Record<"parasha" | "mincha" | "maariv", number>> = {};
  headerRow.forEach((cell, index) => {
    const kind = headerKey(String(cell ?? ""));
    if (kind && col[kind] == null) col[kind] = index;
  });
  if (col.parasha == null || col.mincha == null || col.maariv == null) {
    return {
      rows: [],
      warnings: [
        {
          line: 1,
          message: "חסרות כותרות. נדרש: פרשה, מנחה, ערבית"
        }
      ]
    };
  }

  const byKey = new Map<string, ParashaPrayerCatalogRow>();
  for (let i = 1; i < matrix.length; i += 1) {
    const line = i + 1;
    const row = matrix[i] ?? [];
    const rawParasha = String(row[col.parasha] ?? "").trim();
    const minchaTime = normalizeClockTime(row[col.mincha]);
    const maarivTime = normalizeClockTime(row[col.maariv]);
    if (!rawParasha && !minchaTime && !maarivTime) continue;
    if (!rawParasha) {
      warnings.push({ line, message: "שורה בלי שם פרשה — דולגה" });
      continue;
    }
    const mapped = allowedByNorm.get(normalizeParashaLabel(rawParasha));
    if (!mapped) {
      warnings.push({ line, message: `פרשה לא מזוהה: «${rawParasha}» — דולגה` });
      continue;
    }
    if (!minchaTime && !maarivTime) {
      warnings.push({ line, message: `ל«${mapped}» אין שעת מנחה ולא שעת ערבית — דולגה` });
      continue;
    }
    if (byKey.has(mapped)) {
      warnings.push({ line, message: `«${mapped}» כפולה בקובץ — נשמרה השורה האחרונה` });
    }
    byKey.set(mapped, { parashaKey: mapped, minchaTime, maarivTime });
  }

  return { rows: [...byKey.values()], warnings };
}

/** זוג פרשות מחוברות («מטות-מסעי»). לא מפצל שמות עם מקף פנימי כמו «לך-לך». */
export function parashaPairParts(key: string): [string, string] | null {
  const normalized = normalizeParashaOrderLabel(key);
  const hyphen = normalized.indexOf("-");
  if (hyphen <= 0) return null;
  const first = normalized.slice(0, hyphen).trim();
  const second = normalized.slice(hyphen + 1).trim();
  const firstRank = PARASHA_RANK.get(first);
  const secondRank = PARASHA_RANK.get(second);
  if (
    firstRank == null ||
    secondRank == null ||
    !Number.isInteger(firstRank) ||
    !Number.isInteger(secondRank) ||
    firstRank === secondRank
  ) {
    return null;
  }
  return [first, second];
}

function rowByNormalizedName(catalog: ParashaPrayerCatalogRow[], name: string) {
  return catalog.find((item) => normalizeParashaOrderLabel(item.parashaKey) === name);
}

function catalogRowsForLookup(catalog: ParashaPrayerCatalogRow[], lookupKey: string) {
  const rows: ParashaPrayerCatalogRow[] = [];
  const seen = new Set<string>();
  const push = (row: ParashaPrayerCatalogRow | undefined) => {
    if (!row || seen.has(row.parashaKey)) return;
    seen.add(row.parashaKey);
    rows.push(row);
  };

  push(catalog.find((item) => item.parashaKey === lookupKey));
  const normalized = normalizeParashaOrderLabel(lookupKey);
  if (normalized) push(rowByNormalizedName(catalog, normalized));

  const weekPair = parashaPairParts(lookupKey);
  if (weekPair) {
    for (const part of weekPair) push(rowByNormalizedName(catalog, part));
  } else if (normalized) {
    for (const item of catalog) {
      const pair = parashaPairParts(item.parashaKey);
      if (pair?.includes(normalized)) push(item);
    }
  }

  return rows;
}

/**
 * דירוג התאמת מפתח פרשה לשבוע הנוכחי. מספר נמוך = עדיפות.
 * 0/1 התאמה מדויקת, 2–3 שבוע מחובר מול פרשה בודדת, 4 פרשה בודדת מול שורת זוג.
 */
export function parashaKeyMatchRank(settingKey: string, weekKey: string): number | null {
  const setting = settingKey.trim();
  const week = weekKey.trim();
  if (!setting || !week || week === "לא נמצא") return null;
  if (setting === week) return 0;
  const settingN = normalizeParashaOrderLabel(setting);
  const weekN = normalizeParashaOrderLabel(week);
  if (settingN && settingN === weekN) return 1;

  const weekPair = parashaPairParts(week);
  const settingPair = parashaPairParts(setting);
  if (weekPair) {
    if (!settingPair && settingN === weekPair[0]) return 2;
    if (!settingPair && settingN === weekPair[1]) return 3;
    return null;
  }
  if (settingPair?.includes(weekN)) return 4;
  return null;
}

export function catalogTimeForLookup(
  catalog: ParashaPrayerCatalogRow[] | null | undefined,
  lookupKey: string | null | undefined,
  prayerType: "מנחה" | "ערבית"
): string | null {
  if (!catalog?.length || !lookupKey || lookupKey === "לא נמצא") return null;
  for (const row of catalogRowsForLookup(catalog, lookupKey)) {
    const time = prayerType === "מנחה" ? row.minchaTime : row.maarivTime;
    if (time) return time.slice(0, 5);
  }
  return null;
}

export function buildParashaCatalogTemplateCsv(keys: string[]): string {
  const header = "פרשה,מנחה,ערבית";
  const lines = withParashaCatalogSelectKeys(keys)
    .filter((key) => !parashaPairParts(key))
    .map((key) => `${escapeCsv(key)},,`);
  return `\uFEFF${[header, ...lines].join("\n")}`;
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
