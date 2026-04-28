type KitzurApiResponse = {
  he?: string[] | string;
  sections?: number[];
};

export type KitzurHalacha = {
  bookName: string;
  chapterNumber: number;
  sectionNumber: number;
  fullText: string;
  summaryText: string;
  topic: string;
};

const BOOK_NAME = "קיצור שולחן ערוך";

function stripNiqqud(text: string) {
  return text.replace(/[\u0591-\u05C7]/g, "");
}

function cleanText(text: string) {
  return stripNiqqud(text).replace(/\s+/g, " ").trim();
}

function summarize(text: string) {
  const normalized = cleanText(text);
  if (!normalized) return "";
  const firstSentence = normalized.split(/[.!?]/)[0]?.trim() ?? normalized;
  if (firstSentence.length <= 220) return firstSentence;
  return `${firstSentence.slice(0, 217).trim()}...`;
}

function buildTopic(text: string) {
  const normalized = cleanText(text);
  if (!normalized) return "הלכה יומית";
  const words = normalized
    .replace(/[^\u0590-\u05FF\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const stopWords = new Set(["ו", "של", "על", "את", "לא", "כי", "אם", "אל", "מן", "עם", "ה", "זה", "זו"]);
  const picked = words.filter((word) => !stopWords.has(word)).slice(0, 3);
  return picked.length ? picked.join(" ") : words.slice(0, 3).join(" ") || "הלכה יומית";
}

function pickRequestedSection(he: string[] | string | undefined) {
  if (!he) return null;
  if (typeof he === "string") return he;
  if (!he.length) return null;
  // API with explicit section ref usually returns a single-element array.
  return he[0] ?? null;
}

export async function fetchKitzurHalacha(chapterNumber: number, sectionNumber: number): Promise<KitzurHalacha | null> {
  const ref = `Kitzur_Shulchan_Arukh.${chapterNumber}.${sectionNumber}`;
  const res = await fetch(`https://www.sefaria.org/api/texts/${ref}?lang=he`, {
    cache: "no-store",
    headers: { "Accept-Language": "he-IL,he;q=0.9,en;q=0.8" }
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as KitzurApiResponse;
  const rawSection = pickRequestedSection(payload.he);
  if (!rawSection) return null;
  const fullText = cleanText(rawSection);
  if (!fullText) return null;
  return {
    bookName: BOOK_NAME,
    chapterNumber,
    sectionNumber,
    fullText,
    summaryText: summarize(fullText),
    topic: buildTopic(fullText)
  };
}
