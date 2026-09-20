import { lookupHaftarahName } from "@/lib/haftarah-names";
import { resolveHaftarahMinhag, type HaftarahMinhag } from "@/lib/haftarah-minhag";

export type HaftarahDisplay = {
  name: string | null;
  source: string;
  /** יום כיפור בלבד — מוצג אחרי + בפונט של שם ההפטרה. */
  mincha?: string | null;
};

type LeyningPassage = {
  k?: string;
  b?: string;
  e?: string;
};

export type HebcalLeyningItem = {
  type?: string;
  name?: { en?: string; he?: string };
  haftara?: string;
  sephardic?: string;
  seph?: LeyningPassage | LeyningPassage[];
  chabad?: string | LeyningPassage | LeyningPassage[];
  haft?: LeyningPassage | LeyningPassage[];
  consolation?: number | string;
  admonition?: number;
};

const TANAKH_BOOK: Record<string, string> = {
  Genesis: "בראשית",
  Exodus: "שמות",
  Leviticus: "ויקרא",
  Numbers: "במדבר",
  Deuteronomy: "דברים",
  Joshua: "יהושע",
  Judges: "שופטים",
  "I Samuel": "שמואל א",
  "II Samuel": "שמואל ב",
  "I Kings": "מלכים א",
  "II Kings": "מלכים ב",
  Isaiah: "ישעיהו",
  Jeremiah: "ירמיהו",
  Ezekiel: "יחזקאל",
  Hosea: "הושע",
  Joel: "יואל",
  Amos: "עמוס",
  Obadiah: "עובדיה",
  Jonah: "יונה",
  Micah: "מיכה",
  Nahum: "נחום",
  Habakkuk: "חבקוק",
  Zephaniah: "צפניה",
  Haggai: "חגי",
  Zechariah: "זכריה",
  Malachi: "מלאכי"
};

const BOOK_KEYS = Object.keys(TANAKH_BOOK).sort((a, b) => b.length - a.length);

function numberToHebrew(num: number) {
  if (!Number.isInteger(num) || num <= 0) return String(num);
  const hundreds = ["", "ק", "ר"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const chars: string[] = [];
  const h = Math.floor(num / 100);
  const rem = num % 100;
  if (h > 0) {
    if (h < hundreds.length) chars.push(hundreds[h]);
    else chars.push("ק".repeat(h));
  }
  if (rem === 15) chars.push("טו");
  else if (rem === 16) chars.push("טז");
  else {
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    if (t > 0) chars.push(tens[t]);
    if (o > 0) chars.push(ones[o]);
  }
  return chars.join("") || String(num);
}

function chapMark(n: number) {
  return `${numberToHebrew(n)}׳`;
}

/** במקור ההפטרה מציינים רק ספר ופרק התחלה — בלי פסוק ובלי סוף. */
function startChapterHe(raw: string): string | null {
  const compact = raw.replace(/\u2013|\u2014/g, "-").replace(/\s+/g, "");
  const match = compact.match(/^(\d+)/);
  if (!match) return null;
  const chapter = Number(match[1]);
  if (!Number.isInteger(chapter) || chapter <= 0) return null;
  return chapMark(chapter);
}

function bookKeyAtStart(text: string): string | undefined {
  const lower = text.toLowerCase();
  return BOOK_KEYS.find((key) => lower === key.toLowerCase() || lower.startsWith(`${key.toLowerCase()} `));
}

/** פיצול ציטוטים עם כמה ספרים (פסיק או נקודה-פסיק), בלי לפרק טווחים מאותו ספר. */
function splitBookCitations(english: string): string[] {
  const chunks = english
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const citations: string[] = [];
  for (const chunk of chunks) {
    const bits = chunk.split(",").map((part) => part.trim()).filter(Boolean);
    for (const bit of bits) {
      if (bookKeyAtStart(bit) || citations.length === 0) citations.push(bit);
      else citations[citations.length - 1] += `, ${bit}`;
    }
  }
  return citations;
}

function formatSingleBookCitation(english: string): string {
  const trimmed = english.trim();
  if (!trimmed) return "";
  const bookKey = bookKeyAtStart(trimmed);
  if (!bookKey) return trimmed;
  const bookHe = TANAKH_BOOK[bookKey];
  const rest = trimmed.slice(bookKey.length).trim();
  if (!rest) return bookHe;
  const firstSpan = rest.split(",")[0]?.trim() ?? rest;
  const chapter = startChapterHe(firstSpan);
  return chapter ? `${bookHe} ${chapter}` : bookHe;
}

export function formatHaftarahSource(english: string): string {
  const trimmed = english.trim();
  if (!trimmed) return "";
  const first = splitBookCitations(trimmed)[0];
  return first ? formatSingleBookCitation(first) : "";
}

function formatPassage(passage: LeyningPassage): string | null {
  const book = passage.k?.trim();
  const begin = passage.b?.trim();
  const end = passage.e?.trim();
  if (!book || !begin) return null;
  if (!end || end === begin) return `${book} ${begin}`;
  const [ch1, v1] = begin.split(":");
  const [ch2, v2] = end.split(":");
  if (ch1 && v1 && ch2 && v2 && ch1 === ch2) return `${book} ${ch1}:${v1}-${v2}`;
  return `${book} ${begin}-${end}`;
}

function citationFromPassages(raw: string | LeyningPassage | LeyningPassage[] | undefined): string | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t || null;
  }
  const list = Array.isArray(raw) ? raw : [raw];
  const parts = list.map(formatPassage).filter((part): part is string => Boolean(part));
  if (!parts.length) return null;
  const book = parts[0]?.split(" ")[0];
  if (book && parts.every((part) => part.startsWith(`${book} `))) {
    return `${book} ${parts.map((part) => part.slice(book.length + 1)).join(", ")}`;
  }
  return parts.join(", ");
}

export function citationForMinhag(item: HebcalLeyningItem | null | undefined, minhag: HaftarahMinhag): string | null {
  if (!item) return null;
  if (minhag === "sephardi") {
    return citationFromPassages(item.sephardic) ?? citationFromPassages(item.seph) ?? citationFromPassages(item.haftara) ?? citationFromPassages(item.haft);
  }
  if (minhag === "chabad") {
    return citationFromPassages(item.chabad) ?? citationFromPassages(item.haftara) ?? citationFromPassages(item.haft);
  }
  return citationFromPassages(item.haftara) ?? citationFromPassages(item.haft);
}

function isYomKippurShacharitHaftarah(citation: string): boolean {
  const normalized = citation.toLowerCase().replace(/\s+/g, " ").replace(/\u2013|\u2014/g, "-").trim();
  return normalized.startsWith("isaiah 57:14");
}

export function resolveHaftarahDisplay(
  item: HebcalLeyningItem | null | undefined,
  minhagRaw?: string | null
): HaftarahDisplay | null {
  const minhag = resolveHaftarahMinhag(minhagRaw);
  const citation = citationForMinhag(item, minhag);
  if (!citation) return null;
  const name = lookupHaftarahName(citation, {
    consolation: item?.consolation,
    admonition: item?.admonition
  });
  const source = formatHaftarahSource(citation);
  if (!isYomKippurShacharitHaftarah(citation)) {
    return { name, source };
  }
  return { name, source, mincha: "מפטיר יונה במנחה" };
}
