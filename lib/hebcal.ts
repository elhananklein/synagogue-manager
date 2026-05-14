import { toHebrewDailyLearningDetail } from "@/lib/hebcal-learning-detail-hebrew";

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

export type DailyLearningLine = {
  id: string;
  /** כותרת בעברית לתצוגה */
  title: string;
  /** מקטע היום לתצוגה — בעברית (מומר ממקור Hebcal/Sefaria). */
  detail: string;
};

export type DisplaySnapshot = {
  hebrewDate: string;
  gregorianDate: string;
  parasha: string;
  candleLighting: string | null;
  havdalah: string | null;
  dafYomi: string;
  /** שורות לימוד יומי מעמוד הלימוד של Hebcal (אותו מקור כמו דף יומי במסך הראשי). */
  dailyLearning: DailyLearningLine[];
  zmanim: Array<{ label: string; time: string }>;
  zmanimSourceTimes: Record<string, string>;
  /** צאת הכוכבים ליום האזרחי של הזמנים — לרענון כשהיום העברי מתקדם (לא חצות). */
  halachicDayRollIso: string | null;
  rainText: string;
  blessingText: string;
  omerText: string | null;
  showYaalehVeyavo: boolean;
  sourceEvents: string[];
};

export type DisplaySnapshotOptions = {
  /** כשמושך צילום ליום אחר (למשל מחר) בלי צורך בלימוד יומי — חוסך בקשת רשת */
  omitDailyLearning?: boolean;
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

function stripHebrewNiqqud(text: string) {
  return text.replace(/[\u0591-\u05C7]/g, "");
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
  const holidayKeywordsHe = [
    "ראש חודש",
    "סוכות",
    "פסח",
    "שבועות",
    "ראש השנה",
    "יום כיפור",
    "שמיני עצרת",
    "שמחת תורה"
  ];

  return events.some((event) => {
    const plain = stripHebrewNiqqud(event);
    return (
      holidayKeywords.some((keyword) => event.includes(keyword)) ||
      holidayKeywordsHe.some((keyword) => plain.includes(keyword))
    );
  });
}

const HEBREW_LETTER_GEMATRIA: Record<string, number> = {
  א: 1,
  ב: 2,
  ג: 3,
  ד: 4,
  ה: 5,
  ו: 6,
  ז: 7,
  ח: 8,
  ט: 9,
  י: 10,
  ך: 20,
  כ: 20,
  ל: 30,
  ם: 40,
  מ: 40,
  ן: 50,
  נ: 50,
  ס: 60,
  ע: 70,
  ף: 80,
  פ: 80,
  ץ: 90,
  צ: 90,
  ק: 100,
  ר: 200,
  ש: 300,
  ת: 400
};

function hebrewLettersGematraSum(lettersOnly: string): number {
  let sum = 0;
  for (const ch of lettersOnly) {
    sum += HEBREW_LETTER_GEMATRIA[ch] ?? 0;
  }
  return sum;
}

/** Hebcal: English ordinals / "13. day", Hebrew "כ״ד בעומר", or Lag BaOmer. */
function extractOmerDayFromEvents(events: string[]): number | null {
  for (const raw of events) {
    if (typeof raw !== "string") continue;
    const e = stripHebrewNiqqud(raw).replace(/\u00A0/g, " ").normalize("NFC");
    if (/Lag\s*B['\u2019]?Omer/i.test(e) || /לג\s*בעומר/.test(e)) {
      return 33;
    }

    const en =
      e.match(/(\d+)\s*(?:st|nd|rd|th|\.)?\s+day\s+of\s+the\s+Omer/i) ??
      e.match(/(\d+)\s+day\s+of\s+the\s+Omer/i);
    if (en?.[1]) {
      const day = Number(en[1]);
      if (!Number.isNaN(day) && day >= 1 && day <= 49) return day;
    }

    const he = e.match(/([\u05D0-\u05EA\u05F3\u05F4״"]+)\s*בעומר/);
    if (he?.[1]) {
      const letters = he[1].replace(/[\u05F3\u05F4״"]/g, "");
      const day = hebrewLettersGematraSum(letters);
      if (day >= 1 && day <= 49) return day;
    }

    const omerIdx = e.indexOf("בעומר");
    if (omerIdx > 0) {
      const before = e.slice(0, omerIdx).trimEnd();
      const tail = before.match(/([\u05D0-\u05EA\u05F3\u05F4״"]+)$/);
      if (tail?.[1]) {
        const letters = tail[1].replace(/[\u05F3\u05F4״"]/g, "");
        const day = hebrewLettersGematraSum(letters);
        if (day >= 1 && day <= 49) return day;
      }
    }
  }
  return null;
}

function extractOmerText(events: string[]) {
  const day = extractOmerDayFromEvents(events);
  if (day == null) return null;
  return `היום ${day} ימים לעומר`;
}

export function toIsoDateJerusalem(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  return ymd;
}

export function addDaysIsoDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** מפתח תצוגה לפרשה — זהה ללוגיקת המסך (Hebcal: hebrew או title). */
export function parashaDisplayKeyFromHebcalParashatItem(item: { hebrew?: string; title: string }) {
  return item.hebrew ?? item.title ?? "לא נמצא";
}

/** Civil (Gregorian) day to pass to Hebcal converter for Hebrew date, Omer, holidays — rolls at tzeit, not civil midnight. */
function halachicCivilIsoForConverter(civilIso: string, now: Date, tzeitIso?: string) {
  const jerusalemToday = toIsoDateJerusalem(now);
  if (civilIso !== jerusalemToday) return civilIso;
  if (!tzeitIso) return civilIso;
  const tzeitMs = new Date(tzeitIso).getTime();
  if (Number.isNaN(tzeitMs)) return civilIso;
  if (now.getTime() >= tzeitMs) return addDaysIsoDate(civilIso, 1);
  return civilIso;
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

/** תצוגה ציבורית: לא למטמון Data Cache של Next (מניע תשובות ישנות בלי עומר / תאריך מעודכן). */
const hebcalDisplayFetch: RequestInit = {
  cache: "no-store",
  headers: { "Accept-Language": "en-US,en;q=0.9" }
};

function normalizeDafYomiHebrew(raw: string) {
  const cleaned = raw.replaceAll("/", "").trim();
  const match = cleaned.match(/^([A-Za-z' ]+?)[\s._-]+(\d+)([ab])?$/i);
  if (!match) return raw;

  const masechetKey = match[1].replaceAll(" ", "");
  const dafNumber = Number(match[2]);
  const masechetHebrew = DAF_YOMI_MASECHTOT_HEBREW[masechetKey];
  if (!masechetHebrew || Number.isNaN(dafNumber)) return raw;

  const dafHebrew = numberToHebrew(dafNumber);
  return `${masechetHebrew} ${dafHebrew}`;
}

/** סדר ובתי עמוד Hebcal learning — תואם ל־`<div class="mt-2 mb-4" id="…">` בעמוד. */
const HEBCAL_LEARNING_BLOCK_META: Array<{ id: string; title: string }> = [
  { id: "nachyomi", title: 'נ"ך יומי' },
  { id: "tanakhYomi", title: 'תנ"ך יומי (חלוקת סדרים)' },
  { id: "dailyPsalms", title: "תהילים יומי" },
  { id: "dafyomi", title: "דף יומי" },
  { id: "mishnayomi", title: "משנה יומי" },
  { id: "perekYomi", title: "פרק יומי" },
  { id: "yerushalmi-vilna", title: "ירושלמי יומי (וילנא)" },
  { id: "yerushalmi-schottenstein", title: "ירושלמי יומי (שוטנשטיין)" },
  { id: "dirshuAmudYomi", title: "עמוד היומי (דרשו)" },
  { id: "dafWeekly", title: "דף בשבוע" },
  { id: "dailyRambam1", title: 'רמב"ם — פרק יומי' },
  { id: "dailyRambam3", title: 'רמב"ם — שלושה פרקים' },
  { id: "seferHaMitzvot", title: "ספר המצוות" },
  { id: "arukhHaShulchanYomi", title: "ערוך השולחן יומי" },
  { id: "kitzurShulchanAruch", title: "קיצור שולחן ערוך יומי" },
  { id: "chofetzChaim", title: "חפץ חיים יומי" },
  { id: "shemiratHaLashon", title: "שמירת הלשון יומי" }
];

function extractHebcalLearningBlockHtml(html: string, id: string): string | null {
  const open = `<div class="mt-2 mb-4" id="${id}">`;
  const start = html.indexOf(open);
  if (start === -1) return null;
  const innerStart = start + open.length;
  const subMarker = `<div class="collapse" id="sub-${id}">`;
  const subAt = html.indexOf(subMarker, innerStart);
  if (subAt !== -1) return html.slice(innerStart, subAt);
  const commentMarker = `</div><!-- #${id} -->`;
  const commentAt = html.indexOf(commentMarker, innerStart);
  if (commentAt !== -1) return html.slice(innerStart, commentAt);
  return null;
}

function extractDailyDetailFromLearningBlock(block: string, id: string): string {
  let englishFallback = "";
  if (id === "dafyomi") {
    const m = block.match(/sefaria\.org\/([^"?]+)\?lang=bi/i);
    if (m?.[1]) {
      englishFallback = decodeURIComponent(m[1]).replaceAll("_", " ");
    }
  }
  if (!englishFallback) {
    const lead = block.match(/<div class="lead mt-1">([\s\S]*?)<\/div>/i);
    if (!lead) return "";
    const inner = lead[1].trim();
    const link = inner.match(/<a[^>]*>([^<]+)<\/a>/i);
    if (link?.[1]) englishFallback = link[1].trim().replace(/\s+/g, " ");
    else {
      const plain = inner
        .replace(/<[^>]+>/g, "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)[0];
      englishFallback = plain ?? "";
    }
  }
  return toHebrewDailyLearningDetail(id, block, englishFallback.trim());
}

/** מפרסר את עמוד הלימוד היומי של Hebcal (אותו מקור שממנו נמשך דף יומי במסך הראשי). */
function parseHebcalDailyLearningPage(html: string): DailyLearningLine[] {
  const out: DailyLearningLine[] = [];
  for (const { id, title } of HEBCAL_LEARNING_BLOCK_META) {
    const block = extractHebcalLearningBlockHtml(html, id);
    if (!block) continue;
    const detail = extractDailyDetailFromLearningBlock(block, id).trim();
    if (!detail) continue;
    out.push({ id, title, detail });
  }
  return out;
}

export async function getDisplaySnapshot(
  targetIsoDate?: string,
  options?: DisplaySnapshotOptions
): Promise<DisplaySnapshot> {
  const now = new Date();
  const civilIso = targetIsoDate ?? toIsoDateJerusalem(now);
  const zmanimUrl = `https://www.hebcal.com/zmanim?cfg=json&geo=city&city=IL-Jerusalem&date=${civilIso}`;
  const shabbatUrl = "https://www.hebcal.com/shabbat?cfg=json&geo=city&city=IL-Jerusalem&M=on";

  const [shabbatRes, zmanimRes] = await Promise.all([
    fetch(shabbatUrl, hebcalDisplayFetch),
    fetch(zmanimUrl, hebcalDisplayFetch)
  ]);

  if (!shabbatRes.ok || !zmanimRes.ok) {
    throw new Error("Failed to load Hebcal data");
  }

  const shabbat = (await shabbatRes.json()) as HebcalShabbatResponse;
  const zmanim = (await zmanimRes.json()) as HebcalZmanimResponse;

  const halachicIso = halachicCivilIsoForConverter(civilIso, now, zmanim.times?.tzeit85deg);
  const [hy, hm, hd] = halachicIso.split("-").map(Number);
  const converterUrl = `https://www.hebcal.com/converter?cfg=json&g2h=1&gy=${hy}&gm=${hm}&gd=${hd}`;
  const learningUrl = `https://www.hebcal.com/learning/${civilIso}?cfg=json&geo=city&city=IL-Jerusalem`;

  const converterRes = await fetch(converterUrl, hebcalDisplayFetch);
  const learningRes =
    options?.omitDailyLearning === true
      ? null
      : await fetch(learningUrl, hebcalDisplayFetch);

  if (!converterRes.ok) {
    throw new Error("Failed to load Hebcal data");
  }

  const converter = (await converterRes.json()) as HebcalConverterResponse;

  const eventsList = converter.events;
  const events: string[] = Array.isArray(eventsList)
    ? eventsList.filter((item): item is string => typeof item === "string")
    : [];

  const parashaItem = shabbat.items?.find((item) => item.category === "parashat");
  const parasha = parashaItem ? parashaDisplayKeyFromHebcalParashatItem(parashaItem) : "לא נמצא";
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

  const winter = isWinterSeason(converter.hm, converter.hd);
  const omerText = extractOmerText(events);

  let dafYomi = "לא זמין";
  let dailyLearning: DailyLearningLine[] = [];
  if (learningRes?.ok) {
    const learningHtml = await learningRes.text();
    dailyLearning = parseHebcalDailyLearningPage(learningHtml);
    const dafRow = dailyLearning.find((r) => r.id === "dafyomi");
    if (dafRow?.detail) dafYomi = dafRow.detail;
    else {
      const match = learningHtml.match(/Daf Yomi[\s\S]*?sefaria\.org\/([^"?]+)\?lang=bi/i);
      if (match?.[1]) {
        dafYomi = normalizeDafYomiHebrew(decodeURIComponent(match[1]).replaceAll("_", " "));
      }
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
    dailyLearning,
    zmanim: zmanimRows,
    zmanimSourceTimes: zmanim.times ?? {},
    halachicDayRollIso: zmanim.times?.tzeit85deg ?? null,
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

