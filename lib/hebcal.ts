type HebcalConverterResponse = {
  gy: number;
  gm: number;
  gd: number;
  hy: number;
  hm: string;
  hd: number;
  hebrew: string;
  events?: string[];
};

type HebcalShabbatResponse = {
  items?: Array<{
    title: string;
    hebrew?: string;
    category: string;
    date: string;
  }>;
};

type HebcalZmanimResponse = {
  times?: Record<string, string>;
};

export type DisplaySnapshot = {
  hebrewDate: string;
  gregorianDate: string;
  parasha: string;
  candleLighting: string | null;
  havdalah: string | null;
  dafYomi: string;
  zmanim: Array<{ label: string; time: string }>;
  zmanimSourceTimes: Record<string, string>;
  rainText: string;
  blessingText: string;
  showYaalehVeyavo: boolean;
  sourceEvents: string[];
};

const HEBREW_MONTHS_WINTER = new Set(["Kislev", "Tevet", "Sh'vat", "Adar", "Adar I", "Adar II"]);

function formatHmTime(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem"
  }).format(date);
}

function isWinterSeason(hm: string, hd: number) {
  if (hm === "Cheshvan") return hd >= 7;
  if (hm === "Nisan") return hd < 15;
  return HEBREW_MONTHS_WINTER.has(hm);
}

function hasYaalehVeyavo(events: string[]) {
  const holidayKeywords = [
    "Rosh Chodesh",
    "Sukkot",
    "Pesach",
    "Shavuot",
    "Rosh Hashana",
    "Yom Kippur",
    "Shemini Atzeret",
    "Simchat Torah"
  ];

  return events.some((event) => holidayKeywords.some((keyword) => event.includes(keyword)));
}

function toIsoDateJerusalem(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  return ymd;
}

export async function getDisplaySnapshot(): Promise<DisplaySnapshot> {
  const now = new Date();
  const dateIso = toIsoDateJerusalem(now);
  const [year, month, day] = dateIso.split("-").map(Number);

  const converterUrl = `https://www.hebcal.com/converter?cfg=json&g2h=1&gy=${year}&gm=${month}&gd=${day}`;
  const shabbatUrl = "https://www.hebcal.com/shabbat?cfg=json&geo=city&city=IL-Jerusalem&M=on";
  const zmanimUrl = "https://www.hebcal.com/zmanim?cfg=json&geo=city&city=IL-Jerusalem";
  const learningUrl = "https://www.hebcal.com/learning?cfg=json&geo=city&city=IL-Jerusalem";

  const [converterRes, shabbatRes, zmanimRes, learningRes] = await Promise.all([
    fetch(converterUrl, { next: { revalidate: 300 } }),
    fetch(shabbatUrl, { next: { revalidate: 900 } }),
    fetch(zmanimUrl, { next: { revalidate: 300 } }),
    fetch(learningUrl, { next: { revalidate: 900 } })
  ]);

  if (!converterRes.ok || !shabbatRes.ok || !zmanimRes.ok) {
    throw new Error("Failed to load Hebcal data");
  }

  const converter = (await converterRes.json()) as HebcalConverterResponse;
  const shabbat = (await shabbatRes.json()) as HebcalShabbatResponse;
  const zmanim = (await zmanimRes.json()) as HebcalZmanimResponse;

  const parashaItem = shabbat.items?.find((item) => item.category === "parashat");
  const parasha = parashaItem?.hebrew ?? parashaItem?.title ?? "לא נמצא";
  const candleItem = shabbat.items?.find((item) => item.category === "candles");
  const havdalahItem = shabbat.items?.find((item) => item.category === "havdalah");

  const candleLighting = candleItem?.title?.split(": ").slice(1).join(": ") ?? null;
  const havdalah = havdalahItem?.title?.split(": ").slice(1).join(": ") ?? null;

  const selectedZmanimKeys = [
    { key: "alotHaShachar", label: "עלות השחר" },
    { key: "sunrise", label: "הנץ החמה" },
    { key: "sofZmanShma", label: "סוף זמן קריאת שמע" },
    { key: "chatzot", label: "חצות היום" },
    { key: "minchaGedola", label: "מנחה גדולה" },
    { key: "sunset", label: "שקיעה" },
    { key: "tzeit85deg", label: "צאת הכוכבים" }
  ];

  const zmanimRows = selectedZmanimKeys
    .map(({ key, label }) => {
      const value = zmanim.times?.[key];
      if (!value) return null;
      return { label, time: formatHmTime(value) };
    })
    .filter((row): row is { label: string; time: string } => Boolean(row));

  const events = converter.events ?? [];
  const winter = isWinterSeason(converter.hm, converter.hd);

  let dafYomi = "לא זמין";
  if (learningRes.ok) {
    const learningHtml = await learningRes.text();
    const match = learningHtml.match(/Daf Yomi[\s\S]*?sefaria\.org\/([^"?]+)\?lang=bi/i);
    if (match?.[1]) {
      dafYomi = decodeURIComponent(match[1]).replaceAll("_", " ");
    }
  }

  return {
    hebrewDate: converter.hebrew,
    gregorianDate: new Intl.DateTimeFormat("he-IL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Jerusalem"
    }).format(now),
    parasha,
    candleLighting,
    havdalah,
    dafYomi,
    zmanim: zmanimRows,
    zmanimSourceTimes: zmanim.times ?? {},
    rainText: winter ? "משיב הרוח ומוריד הגשם" : "מוריד הטל",
    blessingText: winter ? "ותן טל ומטר לברכה" : "ותן ברכה",
    showYaalehVeyavo: hasYaalehVeyavo(events),
    sourceEvents: events
  };
}

