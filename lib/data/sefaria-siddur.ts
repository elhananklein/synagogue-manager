import { resolveHaftarahMinhag, type HaftarahMinhag } from "@/lib/haftarah-minhag";
import {
  SIDDUR_PRAYER_LABELS,
  siddurBookSpec,
  siddurNusachLabel,
  siddurNusachNote,
  type SiddurContent,
  type SiddurPrayer,
  type SiddurSection
} from "@/lib/siddur";

type SefariaIndexNode = {
  title?: string;
  heTitle?: string;
  sharedTitle?: string;
  nodes?: SefariaIndexNode[];
};

type SefariaIndexResponse = {
  title?: string;
  heTitle?: string;
  schema?: SefariaIndexNode;
};

type SefariaTextsResponse = {
  error?: string;
  he?: unknown;
  heRef?: string;
};

type SiddurLeaf = {
  ref: string;
  titleHe: string;
};

const INDEX_REVALIDATE_SEC = 60 * 60 * 24 * 7;
const TEXT_REVALIDATE_SEC = 60 * 60 * 24;
const INDEX_TIMEOUT_MS = 15_000;
const TEXT_TIMEOUT_MS = 12_000;
const FETCH_CONCURRENCY = 5;
const SEFARIA_HEADERS = { "Accept-Language": "he-IL,he;q=0.9,en;q=0.8" };

const memoryCache = new Map<string, { at: number; value: SiddurContent }>();
const MEMORY_TTL_MS = TEXT_REVALIDATE_SEC * 1000;

function cacheKey(nusach: HaftarahMinhag, prayer: SiddurPrayer) {
  return `${resolveHaftarahMinhag(nusach)}:${prayer}`;
}

function nodeTitle(node: SefariaIndexNode): string {
  return (node.title || node.sharedTitle || "").trim();
}

function findNode(node: SefariaIndexNode, titles: string[]): SefariaIndexNode | null {
  if (!titles.length) return node;
  const [head, ...rest] = titles;
  const child = (node.nodes ?? []).find((item) => nodeTitle(item) === head);
  if (!child) return null;
  return findNode(child, rest);
}

function collectLeaves(node: SefariaIndexNode, enPath: string[], hePath: string[], out: SiddurLeaf[]) {
  const children = node.nodes;
  if (children?.length) {
    for (const child of children) {
      const enTitle = nodeTitle(child);
      const heTitle = (child.heTitle || enTitle).trim();
      collectLeaves(
        child,
        enTitle ? [...enPath, enTitle] : enPath,
        heTitle ? [...hePath, heTitle] : hePath,
        out
      );
    }
    return;
  }
  if (!enPath.length) return;
  out.push({
    ref: enPath.join(", "),
    titleHe: hePath[hePath.length - 1] || enPath[enPath.length - 1] || ""
  });
}

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
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(flattenHebrew);
  return [];
}

function sanitizeSiddurHtml(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|li)>/gi, "\n");
  const marked = withBreaks
    .replace(/<(?:b|strong)\b[^>]*>/gi, "\u0001")
    .replace(/<\/(?:b|strong)>/gi, "\u0002")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(marked)
    .replace(/\u00a0/g, " ")
    .replace(/\u0001/g, "<b>")
    .replace(/\u0002/g, "</b>")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .replace(/\n/g, "<br>");
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]!, index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

async function fetchSefariaJson<T>(url: string, timeoutMs: number, revalidate: number): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        next: { revalidate },
        signal: AbortSignal.timeout(timeoutMs),
        headers: SEFARIA_HEADERS
      });
      if (res.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      if (attempt === 0) continue;
      return null;
    }
  }
  return null;
}

async function fetchIndex(book: string): Promise<SefariaIndexResponse | null> {
  const url = `https://www.sefaria.org/api/index/${encodeURIComponent(book)}`;
  return fetchSefariaJson<SefariaIndexResponse>(url, INDEX_TIMEOUT_MS, INDEX_REVALIDATE_SEC);
}

async function fetchLeafHtml(ref: string): Promise<string | null> {
  const url = `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?lang=he&commentary=0&pad=0`;
  const data = await fetchSefariaJson<SefariaTextsResponse>(url, TEXT_TIMEOUT_MS, TEXT_REVALIDATE_SEC);
  if (!data || data.error) return null;
  const paragraphs = flattenHebrew(data.he).map(sanitizeSiddurHtml).filter(Boolean);
  if (!paragraphs.length) return null;
  return paragraphs.join("<br><br>");
}

function sefariaReaderUrl(book: string, path: string[]): string {
  const slug = [book, ...path].join(", ").replaceAll(" ", "_");
  return `https://www.sefaria.org/${encodeURIComponent(slug)}?lang=he`;
}

export async function getSiddurContent(nusach: HaftarahMinhag, prayer: SiddurPrayer): Promise<SiddurContent | null> {
  const resolved = resolveHaftarahMinhag(nusach);
  const key = cacheKey(resolved, prayer);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.at < MEMORY_TTL_MS) return cached.value;

  const spec = siddurBookSpec(resolved, prayer);
  const index = await fetchIndex(spec.book);
  const root = index?.schema;
  if (!root) return null;

  const prayerNode = findNode(root, spec.path);
  if (!prayerNode) return null;

  const leaves: SiddurLeaf[] = [];
  collectLeaves(prayerNode, [spec.book, ...spec.path], [index?.heTitle || spec.book], leaves);
  if (!leaves.length) return null;

  const htmlParts = await mapPool(leaves, FETCH_CONCURRENCY, (leaf) => fetchLeafHtml(leaf.ref));
  const sections = leaves
    .map((leaf, index) => {
      const html = htmlParts[index];
      if (!html) return null;
      return { title: leaf.titleHe, html };
    })
    .filter((section): section is SiddurSection => Boolean(section));

  if (!sections.length) return null;

  const value: SiddurContent = {
    prayer,
    prayerLabel: SIDDUR_PRAYER_LABELS[prayer],
    nusach: resolved,
    nusachLabel: siddurNusachLabel(resolved),
    note: siddurNusachNote(resolved),
    sourceLabel: "ספריא",
    sourceUrl: sefariaReaderUrl(spec.book, spec.path),
    sections
  };
  memoryCache.set(key, { at: Date.now(), value });
  return value;
}
