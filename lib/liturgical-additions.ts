/** תוספות עונתיות לאריחי המסך הראשי — מחוץ לגשם/טל, ברכה, עומר ויעלה ויבוא. */

function plainEvent(raw: string) {
  return raw.replace(/[\u0591-\u05C7]/g, "").replace(/\u00A0/g, " ").normalize("NFC").trim();
}

function isErev(event: string) {
  return /^Erev\s/i.test(event) || /^ערב\s/.test(plainEvent(event));
}

function someEvent(events: string[], test: (event: string, plain: string) => boolean) {
  return events.some((event) => test(event, plainEvent(event)));
}

function isChanukahEvent(event: string, plain: string) {
  if (isErev(event)) return false;
  return /Chanukah/i.test(event) || /חנוכ/.test(plain);
}

function isPurimEvent(event: string, plain: string) {
  if (isErev(event)) return false;
  return /^(Purim|Shushan Purim|Purim Katan|Shushan Purim Katan)\b/i.test(event) || /פורים/.test(plain);
}

function isTishaBAvEvent(event: string, plain: string) {
  if (isErev(event)) return false;
  return /Tish'?a\s*B'?Av/i.test(event) || /תשעה\s*באב/.test(plain);
}

function isYomKippurEvent(event: string, plain: string) {
  if (isErev(event)) return false;
  return /Yom Kippur/i.test(event) || /יום\s*כיפור/.test(plain);
}

function isFastDayEvent(event: string, plain: string) {
  if (isErev(event) || isYomKippurEvent(event, plain)) return false;
  return (
    /Tzom Gedaliah/i.test(event) ||
    /Fast of Gedaliah/i.test(event) ||
    /Asara B'?Tevet/i.test(event) ||
    /Tenth of Tevet/i.test(event) ||
    /Ta'?anit Esther/i.test(event) ||
    /Fast of Esther/i.test(event) ||
    /Tzom Tammuz/i.test(event) ||
    /Seventeenth of Tammuz/i.test(event) ||
    /17th of Tammuz/i.test(event) ||
    /Tish'?a\s*B'?Av/i.test(event) ||
    /Ta'?anit Bechorot/i.test(event) ||
    /Fast of the Firstborn/i.test(event) ||
    /צום גדליה/.test(plain) ||
    /עשרה בטבת/.test(plain) ||
    /תענית אסתר/.test(plain) ||
    /צום י[״"']?ז/.test(plain) ||
    /שבעה עשר בתמוז/.test(plain) ||
    /תשעה באב/.test(plain) ||
    /תענית בכורות/.test(plain)
  );
}

function isRoshChodeshEvent(event: string, plain: string) {
  return /Rosh Chodesh/i.test(event) || plain.includes("ראש חודש");
}

function isPesachEvent(event: string, plain: string) {
  if (isErev(event)) return false;
  return /^Pesach\b/i.test(event) || plain.includes("פסח");
}

function isPesachFirstDay(event: string) {
  return /^Pesach(\s+I)?(\s|$)/i.test(event) && !/^Pesach\s+(II|III|IV|V|VI|VII|VIII)\b/i.test(event);
}

function isSukkotHallelDay(event: string, plain: string) {
  if (isErev(event)) return false;
  if (/Shmini Atzeret|Shemini Atzeret|Simchat Torah/i.test(event)) return true;
  if (/שמيني עצרת|שמיני עצרת|שמחת תורה/.test(plain)) return true;
  return /^Sukkot\b/i.test(event) || plain.includes("סוכות") || /הושענא רבה/.test(plain) || /Hoshana Rabbah/i.test(event);
}

function isShavuotEvent(event: string, plain: string) {
  if (isErev(event)) return false;
  return /^Shavuot\b/i.test(event) || plain.includes("שבועות");
}

function isAseretYemeiTeshuva(hebrewMonth: string, hebrewDay: number) {
  return hebrewMonth === "Tishrei" && hebrewDay >= 1 && hebrewDay <= 10;
}

function isNoTachanunByDate(hebrewMonth: string, hebrewDay: number, weekday: number) {
  if (weekday === 6) return true;
  if (hebrewMonth === "Nisan") return true;
  if (hebrewMonth === "Sivan" && hebrewDay <= 12) return true;
  if ((hebrewMonth === "Iyyar" || hebrewMonth === "Iyar") && (hebrewDay === 14 || hebrewDay === 18)) return true;
  if ((hebrewMonth === "Sh'vat" || hebrewMonth === "Shevat") && hebrewDay === 15) return true;
  if (hebrewMonth === "Av" && hebrewDay === 15) return true;
  if (hebrewMonth === "Elul" && hebrewDay === 29) return true;
  if (hebrewMonth === "Tishrei" && (hebrewDay <= 2 || hebrewDay === 9 || hebrewDay === 10 || hebrewDay === 14)) {
    return true;
  }
  if (
    (hebrewMonth === "Adar" || hebrewMonth === "Adar I" || hebrewMonth === "Adar II") &&
    (hebrewDay === 14 || hebrewDay === 15)
  ) {
    return true;
  }
  return false;
}

function isNoTachanunByEvent(events: string[]) {
  return someEvent(events, (event, plain) => {
    if (isChanukahEvent(event, plain) || isPurimEvent(event, plain) || isTishaBAvEvent(event, plain)) return true;
    if (isRoshChodeshEvent(event, plain)) return true;
    if (isPesachEvent(event, plain) || isSukkotHallelDay(event, plain) || isShavuotEvent(event, plain)) return true;
    if (isYomKippurEvent(event, plain)) return true;
    if (/Rosh Hashana/i.test(event) || /ראש השנה/.test(plain)) return true;
    if (/Isru Chag/i.test(event) || /אסרו חג/.test(plain)) return true;
    if (/Yom HaAtzmaut|Yom Yerushalayim/i.test(event) || /יום העצמאות|יום ירושלים/.test(plain)) return true;
    if (/Tu BiShvat|Tu B'?Shvat|Tu B'?Av|Lag BaOmer|Pesach Sheni/i.test(event)) return true;
    return false;
  });
}

function resolveHallel(events: string[]): string | null {
  if (someEvent(events, isChanukahEvent)) return "הלל שלם";
  if (someEvent(events, isShavuotEvent)) return "הלל שלם";
  if (someEvent(events, isSukkotHallelDay)) return "הלל שלם";
  if (events.some((event) => isPesachFirstDay(event))) return "הלל שלם";
  if (someEvent(events, isPesachEvent)) return "חצי הלל";
  if (someEvent(events, isRoshChodeshEvent) && !someEvent(events, isChanukahEvent)) return "חצי הלל";
  return null;
}

export function resolveLiturgicalTiles(opts: {
  events: string[];
  hebrewMonth: string;
  hebrewDay: number;
  weekday: number;
}): string[] {
  const { events, hebrewMonth, hebrewDay, weekday } = opts;
  const tiles: string[] = [];

  if (someEvent(events, isChanukahEvent) || someEvent(events, isPurimEvent)) {
    tiles.push("על הניסים");
  }
  if (someEvent(events, isFastDayEvent)) {
    tiles.push("עננו");
  }
  if (someEvent(events, isTishaBAvEvent)) {
    tiles.push("נחם");
  }
  if (isAseretYemeiTeshuva(hebrewMonth, hebrewDay)) {
    tiles.push("המלך הקדוש");
    tiles.push("המלך המשפט");
    tiles.push("עשרת ימי תשובה");
  }
  if (isNoTachanunByDate(hebrewMonth, hebrewDay, weekday) || isNoTachanunByEvent(events)) {
    tiles.push("אין תחנון");
  }
  const hallel = resolveHallel(events);
  if (hallel) tiles.push(hallel);

  return tiles;
}

export const PREVIEW_LITURGICAL_TILES = [
  "על הניסים",
  "עננו",
  "נחם",
  "המלך הקדוש",
  "המלך המשפט",
  "עשרת ימי תשובה",
  "אין תחנון",
  "הלל שלם"
];

export const PREVIEW_LITURGICAL_BY_KEY: Record<string, string> = {
  alhanissim: "על הניסים",
  aneinu: "עננו",
  nachem: "נחם",
  hakadosh: "המלך הקדוש",
  hamishpat: "המלך המשפט",
  aseret: "עשרת ימי תשובה",
  teshuva: "עשרת ימי תשובה",
  zichronot: "עשרת ימי תשובה",
  tachanun: "אין תחנון",
  hallel: "הלל שלם",
  hallelhalf: "חצי הלל"
};

export function previewTilesFromKeys(keys: string[]): string[] {
  const tiles: string[] = [];
  const seen = new Set<string>();
  const expanded = keys.flatMap((raw) => {
    const key = raw.trim().toLowerCase();
    if (key === "teshuva") return ["hakadosh", "hamishpat", "aseret"];
    return [key];
  });
  for (const key of expanded) {
    const tile = PREVIEW_LITURGICAL_BY_KEY[key];
    if (!tile || seen.has(tile)) continue;
    seen.add(tile);
    tiles.push(tile);
  }
  return tiles;
}
