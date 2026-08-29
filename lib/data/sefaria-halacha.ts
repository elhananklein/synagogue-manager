export type HalachaContent = {
  title: string;
  text: string;
  segments: string[];
};

const SEFARIA_CALENDARS_URL = "https://www.sefaria.org/api/calendars";
const LIVE_TIMEOUT_MS = 4000;
const LIVE_REVALIDATE_SEC = 60 * 60;

type SefariaCalendarItem = {
  title?: { en?: string; he?: string };
  displayValue?: { en?: string; he?: string };
  ref?: string;
  url?: string;
  category?: string;
};

type SefariaCalendarsResponse = {
  calendar_items?: SefariaCalendarItem[];
};

type SefariaTextsResponse = {
  he?: unknown;
  heRef?: string;
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function flattenHebrew(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenHebrew);
  return [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * שולחן ערוך מגיע בלי נקודות; סימני הפרשנים יושבים בין משפטים.
 * מוסיפים נקודה לפני פתיחת דין חדש כדי שאפשר יהיה לקרוא על המסך.
 */
function punctuateHalachaHebrew(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;

  const starters = [
    "ויש אומרים",
    "יש אומרים",
    "וי\"א",
    "י\"א",
    "ואם לא",
    "ואם הוא",
    "ואם",
    "ואין",
    "וכן",
    "וכש",
    "ואפילו",
    "ואפי'",
    "לפיכך",
    "הגה:"
  ].sort((a, b) => b.length - a.length);

  for (const starter of starters) {
    const re = new RegExp(`(?<![.!?׃:])\\s+(${escapeRegExp(starter)})`, "g");
    t = t.replace(re, ". $1");
  }

  t = t.replace(/\s+/g, " ").replace(/\s+([.!?׃:])/g, "$1").trim();
  if (!/[.!?׃]$/.test(t)) t += ".";
  return t;
}

function cleanSefariaHtml(html: string): string {
  const withoutNotes = html
    .replace(/<i\b[^>]*data-commentator[^>]*>[\s\S]*?<\/i>/gi, " ")
    .replace(/<i\b[^>]*>\s*<\/i>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const cleaned = decodeHtmlEntities(withoutNotes)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return punctuateHalachaHebrew(cleaned);
}

function isHalachaYomit(item: SefariaCalendarItem) {
  const titleHe = item.title?.he ?? "";
  const titleEn = item.title?.en ?? "";
  return /הלכה יומית/.test(titleHe) || /Halakhah Yomit/i.test(titleEn);
}

function stripSimanHeading(text: string): string {
  return text.replace(/^.{0,90}?ובו\s+[א-ת0-9]+\s+סעיפים:\s*/u, "").trim();
}

async function fetchSefariaHebrew(path: string): Promise<SefariaTextsResponse | null> {
  const textsRes = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(path)}?lang=he&commentary=0`, {
    next: { revalidate: LIVE_REVALIDATE_SEC },
    signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
    headers: { "Accept-Language": "he-IL,he;q=0.9,en;q=0.8" }
  });
  if (!textsRes.ok) return null;
  return (await textsRes.json()) as SefariaTextsResponse;
}

/** כל סעיפי היום מספריא. כל סעיף יוצג בנפרד על המסך — בלי לדלג. */
export async function getSefariaHalachaYomit(): Promise<HalachaContent | null> {
  try {
    const calendarsRes = await fetch(SEFARIA_CALENDARS_URL, {
      next: { revalidate: LIVE_REVALIDATE_SEC },
      signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
      headers: { "Accept-Language": "he-IL,he;q=0.9,en;q=0.8" }
    });
    if (!calendarsRes.ok) return null;
    const calendars = (await calendarsRes.json()) as SefariaCalendarsResponse;
    const item = calendars.calendar_items?.find(isHalachaYomit);
    if (!item) return null;

    const path = (item.url || item.ref || "").trim().replaceAll(" ", "_");
    if (!path) return null;

    const texts = await fetchSefariaHebrew(path);
    if (!texts) return null;
    const segments = flattenHebrew(texts.he)
      .map(cleanSefariaHtml)
      .map((paragraph, index) => (index === 0 ? stripSimanHeading(paragraph) : paragraph))
      .filter(Boolean);
    if (!segments.length) return null;

    const topic = texts.heRef ?? item.displayValue?.he ?? item.ref ?? "";
    const title = topic ? `הלכה יומית — ${topic}` : "הלכה יומית";
    return { title, text: segments[0] ?? "", segments };
  } catch {
    return null;
  }
}

export async function getYalkutDailyHalacha(): Promise<HalachaContent | null> {
  return getSefariaHalachaYomit();
}

export async function getSefariaDailyHalachaSummary(): Promise<HalachaContent | null> {
  return getSefariaHalachaYomit();
}
