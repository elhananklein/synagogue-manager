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
  omerText: string | null;
  showYaalehVeyavo: boolean;
  sourceEvents: string[];
};

const HEBREW_MONTHS_WINTER = new Set(["Kislev", "Tevet", "Sh'vat", "Adar", "Adar I", "Adar II"]);
const DAF_YOMI_MASECHTOT_HEBREW: Record<string, string> = {
  Berakhot: "ברכות",
  Shabbat: "שבת",
  Eruvin: "עירובין",
  Pesachim: "פסחים",
  Shekalim: "שקלים",
  Yoma: "יומא",
  Sukkah: "סוכה",
  Beitzah: "ביצה",
  RoshHashanah: "ראש השנה",
  Taanit: "תענית",
  Megillah: "מגילה",
  MoedKatan: "מועד קטן",
  Chagigah: "חגיגה",
  Yevamot: "יבמות",
  Ketubot: "כתובות",
  Nedarim: "נדרים",
  Nazir: "נזיר",
  Sotah: "סוטה",
  Gittin: "גיטין",
  Kiddushin: "קידושין",
  BavaKamma: "בבא קמא",
  BavaMetzia: "בבא מציעא",
  BavaBatra: "בבא בתרא",
  Sanhedrin: "סנהדרין",
  Makkot: "מכות",
  Shevuot: "שבועות",
  AvodahZarah: "עבודה זרה",
  Horayot: "הוריות",
  Zevachim: "זבחים",
  Menachot: "מנחות",
  Chullin: "חולין",
  Bekhorot: "בכורות",
  Arakhin: "ערכין",
  Temurah: "תמורה",
  Keritot: "כריתות",
  Meilah: "מעילה",
  Kinnim: "קינים",
  Tamid: "תמיד",
  Middot: "מידות",
  Niddah: "נידה"
};

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

function extractOmerText(events: string[]) {
  const omerEvent = events.find((event) => /day of the Omer/i.test(event));
  if (!omerEvent) return null;
  const match = omerEvent.match(/(\d+)\w*\s+day of the Omer/i);
  if (!match?.[1]) return null;
  const day = Number(match[1]);
  if (Number.isNaN(day) || day <= 0) return null;
  return `היום ${day} ימים לעומר`;
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

function addDaysIsoDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function stripHebrewNiqqud(text: string) {
  return text.replace(/[\u0591-\u05C7]/g, "");
}

function numberToHebrew(num: number) {
  if (num <= 0) return String(num);
  if (num === 15) return 'ט"ו';
  if (num === 16) return 'ט"ז';

  const hundreds = ["", "ק", "ר"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const chars: string[] = [];

  const h = Math.floor(num / 100);
  const remainderAfterHundreds = num % 100;
  if (h > 0) {
    if (h < hundreds.length) {
      chars.push(hundreds[h]);
    } else {
      chars.push("ק".repeat(h));
    }
  }

  const t = Math.floor(remainderAfterHundreds / 10);
  const o = remainderAfterHundreds % 10;
  if (t > 0) chars.push(tens[t]);
  if (o > 0) chars.push(ones[o]);

  const raw = chars.join("");
  if (!raw) return String(num);
  if (raw.length === 1) return `${raw}'`;
  return `${raw.slice(0, -1)}"${raw.slice(-1)}`;
}

function normalizeDafYomiHebrew(raw: string) {
  const cleaned = raw.replaceAll("/", "").trim();
  const match = cleaned.match(/^([A-Za-z' ]+?)[\s._-]+(\d+)([ab])?$/i);
  if (!match) return raw;

  const masechetKey = match[1].replaceAll(" ", "");
  const dafNumber = Number(match[2]);
  const amud = match[3]?.toLowerCase();
  const masechetHebrew = DAF_YOMI_MASECHTOT_HEBREW[masechetKey];
  if (!masechetHebrew || Number.isNaN(dafNumber)) return raw;

  const dafHebrew = numberToHebrew(dafNumber);
  if (!amud) {
    return `${masechetHebrew} ${dafHebrew}`;
  }
  return `${masechetHebrew} ${dafHebrew} עמוד ${amud === "a" ? "א" : "ב"}`;
}

export async function getDisplaySnapshot(targetIsoDate?: string): Promise<DisplaySnapshot> {
  const now = new Date();
  const dateIso = targetIsoDate ?? toIsoDateJerusalem(now);
  const [year, month, day] = dateIso.split("-").map(Number);

  const converterUrl = `https://www.hebcal.com/converter?cfg=json&g2h=1&gy=${year}&gm=${month}&gd=${day}`;
  const shabbatUrl = "https://www.hebcal.com/shabbat?cfg=json&geo=city&city=IL-Jerusalem&M=on";
  const zmanimUrl = `https://www.hebcal.com/zmanim?cfg=json&geo=city&city=IL-Jerusalem&date=${dateIso}`;
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
  const omerText = extractOmerText(events);

  let dafYomi = "לא זמין";
  if (learningRes.ok) {
    const learningHtml = await learningRes.text();
    const match = learningHtml.match(/Daf Yomi[\s\S]*?sefaria\.org\/([^"?]+)\?lang=bi/i);
    if (match?.[1]) {
      const decoded = decodeURIComponent(match[1]).replaceAll("_", " ");
      dafYomi = normalizeDafYomiHebrew(decoded);
    }
  }

  return {
    hebrewDate: stripHebrewNiqqud(converter.hebrew),
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
    omerText,
    showYaalehVeyavo: hasYaalehVeyavo(events),
    sourceEvents: events
  };
}

export function getTomorrowIsoDateFrom(baseIsoDate: string) {
  return addDaysIsoDate(baseIsoDate, 1);
}

