import { addDaysIsoDate, parashaDisplayKeyFromHebcalParashatItem, toIsoDateJerusalem } from "@/lib/hebcal";

type HebcalCalItem = {
  category?: string;
  hebrew?: string;
  title?: string;
};

type HebcalCalResponse = {
  items?: HebcalCalItem[];
};

const hebcalFetch: RequestInit = {
  headers: { Accept: "application/json" },
  next: { revalidate: 86400 }
};

/**
 * רשימת מפתחות פרשה (עברית) כפי שמופיעים באירועי Hebcal — לאותו פורמט כמו `snapshot.parasha`.
 * נטען מטווח תאריכים (לא נשמר ב־DB).
 */
export async function fetchJerusalemParashaCatalogKeys(): Promise<string[]> {
  const today = toIsoDateJerusalem();
  const start = addDaysIsoDate(today, -28);
  const end = addDaysIsoDate(today, 420);
  const url = `https://www.hebcal.com/hebcal?cfg=json&v=1&s=on&start=${start}&end=${end}&geo=city&city=IL-Jerusalem&maj=on`;
  const res = await fetch(url, hebcalFetch);
  if (!res.ok) return [];
  const data = (await res.json()) as HebcalCalResponse;
  const items = data.items ?? [];
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.category !== "parashat") continue;
    const key = parashaDisplayKeyFromHebcalParashatItem({
      hebrew: item.hebrew,
      title: item.title ?? ""
    });
    if (!key || key === "לא נמצא") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}
