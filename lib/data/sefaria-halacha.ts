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

export type HalachaContent = {
  title: string;
  text: string;
};

const YALKUT_DAILY_FEED =
  "https://yalkutyosef.co.il/category/%D7%94%D7%9C%D7%9B%D7%94-%D7%99%D7%95%D7%9E%D7%99%D7%AA/feed/";

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function stripHebrewNiqqud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, "");
}

function formatYalkutFullText(rawDescription: string): string {
  const clean = stripHebrewNiqqud(stripHtml(decodeHtmlEntities(rawDescription))).trim();
  const openingLineRegex = /["״']?\s*כל השונה הלכות בכל יום\s+מובטח לו שהוא בן העולם הבא["״']?\s*/;
  const openingMatch = clean.match(openingLineRegex)?.[0]?.trim();
  const withoutOpening = clean.replace(openingLineRegex, "").trim();

  // Source/citation line at the bottom (e.g. "ילקו"י שבת ... סימן ...") should not appear in body.
  const sourceLineRegex = /\s*ילקו["׳״']?י[\s\S]*$/i;
  const withoutSourceLine = withoutOpening.replace(sourceLineRegex, "").trim();

  if (!openingMatch) return withoutSourceLine;
  return `${withoutSourceLine}\n\n${openingMatch}`;
}

function isHalachaYomit(item: SefariaCalendarItem) {
  const titleHe = item.title?.he ?? "";
  const titleEn = item.title?.en ?? "";
  return /הלכה יומית/.test(titleHe) || /Halakhah Yomit/i.test(titleEn);
}

export async function getSefariaDailyHalachaSummary(): Promise<HalachaContent | null> {
  const yalkutRes = await fetch(YALKUT_DAILY_FEED, {
    cache: "no-store",
    headers: { "Accept-Language": "he-IL,he;q=0.9,en;q=0.8" }
  });
  if (yalkutRes.ok) {
    const xml = await yalkutRes.text();
    const item = xml.match(/<item>([\s\S]*?)<\/item>/i)?.[1];
    if (item) {
      const rawTitle = item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "הלכה יומית - ילקוט יוסף";
      const rawDescription =
        item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] ??
        item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ??
        "";
      const cleanedDescription = rawDescription.replace(/הפוסט[\s\S]*?הופיע לראשונה[\s\S]*$/i, "").trim();
      const title = decodeHtmlEntities(stripHtml(rawTitle)).replace(/\s+/g, " ").trim();
      const text = formatYalkutFullText(cleanedDescription || "הלכה יומית מאתר ילקוט יוסף");
      if (title && text) return { title, text };
    }
  }

  const calendarsRes = await fetch("https://www.sefaria.org/api/calendars", {
    cache: "no-store",
    headers: { "Accept-Language": "he-IL,he;q=0.9,en;q=0.8" }
  });
  if (!calendarsRes.ok) return null;

  const calendars = (await calendarsRes.json()) as SefariaCalendarsResponse;
  const item =
    calendars.calendar_items?.find(isHalachaYomit) ??
    calendars.calendar_items?.find((entry) => entry.category === "Halakhah");
  if (!item?.ref) return null;

  const rawTitle = item.title?.he ?? item.title?.en ?? "הלכה יומית";
  const display = item.displayValue?.he ?? item.displayValue?.en ?? item.ref;
  const title = `${rawTitle} - ${display}`;
  return { title, text: display };
}
