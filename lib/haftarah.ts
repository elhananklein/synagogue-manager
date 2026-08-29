import { lookupHaftarahName } from "@/lib/haftarah-names";
import { resolveHaftarahMinhag, type HaftarahMinhag } from "@/lib/haftarah-minhag";

export type HaftarahDisplay = {
  name: string | null;
  source: string;
};

type LeyningPassage = {
  k?: string;
  b?: string;
  e?: string;
};

export type HebcalLeyningItem = {
  type?: string;
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

function formatRange(ch1: number, v1: number, ch2?: number, v2?: number) {
  if (ch2 == null || v2 == null || (ch2 === ch1 && v2 === v1)) {
    return `${chapMark(ch1)} ${numberToHebrew(v1)}`;
  }
  if (ch2 === ch1) {
    return `${chapMark(ch1)} ${numberToHebrew(v1)}–${numberToHebrew(v2)}`;
  }
  return `${chapMark(ch1)} ${numberToHebrew(v1)} – ${chapMark(ch2)} ${numberToHebrew(v2)}`;
}

function parseEnglishRange(raw: string): string | null {
  const same = raw.match(/^(\d+):(\d+)-(\d+)$/);
  if (same) {
    return formatRange(Number(same[1]), Number(same[2]), Number(same[1]), Number(same[3]));
  }
  const cross = raw.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
  if (cross) {
    return formatRange(Number(cross[1]), Number(cross[2]), Number(cross[3]), Number(cross[4]));
  }
  const single = raw.match(/^(\d+):(\d+)$/);
  if (single) {
    return formatRange(Number(single[1]), Number(single[2]));
  }
  return null;
}

export function formatHaftarahSource(english: string): string {
  const trimmed = english.trim();
  if (!trimmed) return "";
  const bookKey = BOOK_KEYS.find((key) => trimmed === key || trimmed.startsWith(`${key} `));
  if (!bookKey) return trimmed;
  const bookHe = TANAKH_BOOK[bookKey];
  const rest = trimmed.slice(bookKey.length).trim();
  if (!rest) return bookHe;
  const parts = rest.split(",").map((part) => part.trim()).filter(Boolean);
  const heParts = parts.map((part) => parseEnglishRange(part) ?? part);
  return `${bookHe} ${heParts.join(", ")}`;
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

export function resolveHaftarahDisplay(
  item: HebcalLeyningItem | null | undefined,
  minhagRaw?: string | null
): HaftarahDisplay | null {
  const minhag = resolveHaftarahMinhag(minhagRaw);
  const citation = citationForMinhag(item, minhag);
  if (!citation) return null;
  return {
    name: lookupHaftarahName(citation, {
      consolation: item?.consolation,
      admonition: item?.admonition
    }),
    source: formatHaftarahSource(citation)
  };
}
