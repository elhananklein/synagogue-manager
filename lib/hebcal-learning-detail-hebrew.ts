/**
 * המרת מקטעי לימוד יומי (מ־Hebcal / Sefaria) לעברית לתצוגה.
 * ללא ייבוא מ־hebcal.ts — למניעת תלות מעגלית.
 */

function numberToHebrew(num: number) {
  if (!Number.isInteger(num) || num <= 0) return String(num);
  if (num === 15) return 'ט"ו';
  if (num === 16) return 'ט"ז';

  const hundreds = ["", "ק", "ר"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const chars: string[] = [];

  const h = Math.floor(num / 100);
  let rem = num % 100;
  if (h > 0) {
    if (h < hundreds.length) chars.push(hundreds[h]);
    else chars.push("ק".repeat(h));
  }

  const t = Math.floor(rem / 10);
  const o = rem % 10;
  if (t > 0) chars.push(tens[t]);
  if (o > 0) chars.push(ones[o]);

  const raw = chars.join("");
  if (!raw) return String(num);
  if (raw.length === 1) return `${raw}'`;
  return `${raw.slice(0, -1)}"${raw.slice(-1)}`;
}

/** כל רצף ספרות בטקסט ASCII (פרקים, דפים וכו׳) — להמרה בעברית לתצוגה. */
function allDigitRunsToHebrew(s: string): string {
  return s.replace(/-/g, "–").replace(/(\d+)/g, (_, d) => numberToHebrew(Number(d)));
}

const BAVLI_MASECHTA: Record<string, string> = {
  "Bava Kamma": "בבא קמא",
  "Bava Metzia": "בבא מציעא",
  "Bava Batra": "בבא בתרא",
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

function bavliPathToHebrew(path: string): string | null {
  const cleaned = path.replaceAll("/", "").trim();
  const match = cleaned.match(/^([A-Za-z' ]+?)[\s._-]+(\d+)([ab])?$/i);
  if (!match) return null;
  const rawMasechet = match[1].trim();
  const masechetKey = rawMasechet.replaceAll(" ", "");
  const dafNumber = Number(match[2]);
  const side = match[3]?.toLowerCase();
  const masechetHe = BAVLI_MASECHTA[masechetKey] ?? BAVLI_MASECHTA[rawMasechet];
  if (!masechetHe || Number.isNaN(dafNumber)) return null;
  const dafHe = numberToHebrew(dafNumber);
  if (side === "a") return `${masechetHe} ${dafHe} עמוד א׳`;
  if (side === "b") return `${masechetHe} ${dafHe} עמוד ב׳`;
  return `${masechetHe} ${dafHe}`;
}

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
  Malachi: "מלאכי",
  Psalms: "תהילים",
  Proverbs: "משלי",
  Job: "איוב",
  Ruth: "רות",
  "Song of Songs": "שיר השירים",
  Ecclesiastes: "קהלת",
  Lamentations: "איכה",
  Esther: "אסתר",
  Daniel: "דניאל",
  Ezra: "עזרא",
  Nehemiah: "נחמיה",
  "I Chronicles": "דברי הימים א",
  "II Chronicles": "דברי הימים ב"
};

/** הפניה אחרי שם הספר: פרק בלבד / פרק ופסוק / טווחים — כולל גימטריה. */
function tanakhRefSuffixToHebrew(rest: string): string {
  const r = rest.trim();
  if (!r) return "";

  const cross = r.match(/^(\d+)\.(\d+)-(\d+)\.(\d+)$/);
  if (cross) {
    const c1 = Number(cross[1]);
    const v1 = Number(cross[2]);
    const c2 = Number(cross[3]);
    const v2 = Number(cross[4]);
    return `פרק ${numberToHebrew(c1)} פסוק ${numberToHebrew(v1)} – פרק ${numberToHebrew(c2)} פסוק ${numberToHebrew(v2)}`;
  }

  const sameCh = r.match(/^(\d+)\.(\d+)-(\d+)$/);
  if (sameCh) {
    const c = Number(sameCh[1]);
    const v1 = Number(sameCh[2]);
    const v2 = Number(sameCh[3]);
    return `פרק ${numberToHebrew(c)} פסוקים ${numberToHebrew(v1)}–${numberToHebrew(v2)}`;
  }

  const cv = r.match(/^(\d+)\.(\d+)$/);
  if (cv) {
    const c = Number(cv[1]);
    const v = Number(cv[2]);
    return `פרק ${numberToHebrew(c)} פסוק ${numberToHebrew(v)}`;
  }

  const chOnly = r.match(/^(\d+)$/);
  if (chOnly) {
    return numberToHebrew(Number(chOnly[1]));
  }

  return r
    .split("-")
    .map((part) => part.trim().replace(/:/g, "׃"))
    .join("–");
}

function tanakhOrNachPathToHebrew(path: string): string | null {
  const normalized = path.replaceAll("_", " ").trim();
  const dot = normalized.indexOf(".");
  if (dot === -1) {
    const book = TANAKH_BOOK[normalized];
    return book ?? null;
  }
  const bookKey = normalized.slice(0, dot).trim();
  const rest = normalized.slice(dot + 1);
  const bookHe = TANAKH_BOOK[bookKey];
  if (!bookHe) return null;
  if (!rest) return bookHe;
  const suffix = tanakhRefSuffixToHebrew(rest);
  if (!suffix) return bookHe;
  if (suffix.includes("פרק") || suffix.includes("פסוק")) {
    return `${bookHe} — ${suffix}`;
  }
  return `${bookHe} ${suffix}`;
}

function psalmsPathToHebrew(path: string): string | null {
  const m = path.trim().match(/^Psalms[.\s]+([\d.-]+)$/i);
  if (!m?.[1]) return null;
  const parts = m[1].split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    const n = Number(parts[0]);
    if (!Number.isNaN(n)) return `תהילים ${numberToHebrew(n)}`;
  }
  if (parts.length === 2) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (!Number.isNaN(a) && !Number.isNaN(b)) return `תהילים ${numberToHebrew(a)}–${numberToHebrew(b)}`;
  }
  return `תהילים — ${m[1]}`;
}

const MISHNAH_TRACT: Record<string, string> = {
  Berakhot: "ברכות",
  Peah: "פאה",
  Demai: "דמאי",
  Kilayim: "כלאים",
  Sheviit: "שביעית",
  Terumot: "תרומות",
  Maasrot: "מעשרות",
  "Maaser Sheni": "מעשר שני",
  Challah: "חלה",
  Orlah: "ערלה",
  Bikkurim: "ביכורים",
  Shabbat: "שבת",
  Eruvin: "עירובין",
  Pesachim: "פסחים",
  Shekalim: "שקלים",
  Yoma: "יומא",
  Sukkah: "סוכה",
  Beitzah: "ביצה",
  "Rosh Hashanah": "ראש השנה",
  Taanit: "תענית",
  Megillah: "מגילה",
  "Moed Katan": "מועד קטן",
  Chagigah: "חגיגה",
  Yevamot: "יבמות",
  Ketubot: "כתובות",
  Nedarim: "נדרים",
  Nazir: "נזיר",
  Sotah: "סוטה",
  Gittin: "גיטין",
  Kiddushin: "קידושין",
  "Bava Kamma": "בבא קמא",
  "Bava Metzia": "בבא מציעא",
  "Bava Batra": "בבא בתרא",
  Sanhedrin: "סנהדרין",
  Makkot: "מכות",
  Shevuot: "שבועות",
  Eduyot: "עדיות",
  "Avodah Zarah": "עבודה זרה",
  Avot: "אבות",
  Horayot: "הוריות",
  Zevachim: "זבחים",
  Menachot: "מנחות",
  Chullin: "חולין",
  Bekhorot: "בכורות",
  Arakhin: "ערכין",
  Temurah: "תמורה",
  Keritot: "כריתות",
  Meilah: "מעילה",
  Tamid: "תמיד",
  Middot: "מידות",
  Kinnim: "קינים",
  Oholot: "אהלות",
  Negaim: "נגעים",
  Parah: "פרה",
  Tahorot: "טהרות",
  Mikvaot: "מקוואות",
  Niddah: "נידה",
  Makhshirin: "מכשירין",
  Zavim: "זבים",
  "Tevul Yom": "טבול יום",
  Yadayim: "ידיים",
  Oktzin: "עוקצים",
  Kelim: "כלים",
  Moed_Katan: "מועד קטן"
};

function mishnahPathToHebrew(path: string): string | null {
  const m = path.trim().match(/^Mishnah[\s_]+([^.]+)\.(.+)$/i);
  if (!m?.[1] || !m[2]) return null;
  const tractKey = m[1].replaceAll("_", " ").trim();
  const tractHe = MISHNAH_TRACT[tractKey] ?? MISHNAH_TRACT[m[1].replaceAll("_", " ")];
  if (!tractHe) return null;
  const refRaw = m[2].replace(/:/g, "׃");
  const structured = refRaw.match(/^(\d+)\.(\d+)(?:–(\d+)|-(\d+))?$/);
  if (structured) {
    const ch = Number(structured[1]);
    const m1 = Number(structured[2]);
    const mEnd = structured[3] ?? structured[4];
    if (mEnd !== undefined) {
      const me = Number(mEnd);
      return `מסכת ${tractHe} — פרק ${numberToHebrew(ch)}, משניות ${numberToHebrew(m1)}–${numberToHebrew(me)}`;
    }
    return `מסכת ${tractHe} — פרק ${numberToHebrew(ch)}, משנה ${numberToHebrew(m1)}`;
  }
  return `מסכת ${tractHe} ${allDigitRunsToHebrew(refRaw)}`;
}

const RAMBAM_BOOK: Record<string, string> = {
  Blessings: "הלכות ברכות",
  Prayer: "הלכות תפילה",
  Tefillin: "הלכות תפילין",
  Mezuzah: "הלכות מזוזה",
  Torah_Reading: "הלכות קריאת התורה",
  Shema: "הלכות קריאת שמע",
  Chanukah: "הלכות חנוכה",
  Megillah: "הלכות מגילה",
  Fast_Days: "הלכות תעניות",
  Pesach: "הלכות חמץ ומצה",
  Shofar: "הלכות שופר וסוכה ולולב",
  Sukkah: "הלכות שופר וסוכה ולולב",
  Yom_Tov: "הלכות שביתת יום טוב",
  Eruvin: "הלכות עירובין",
  Rest_on_a_Holiday: "הלכות שביתת יום טוב",
  Marriage: "הלכות אישות",
  Divorce: "הלכות גירושין",
  Levirate_Marriage_and_Release: "הלכות יבום וחליצה",
  Naarah: "הלכות נערה בתולה",
  Virgin_Maiden: "הלכות נערה בתולה",
  Forbidden_Intercourse: "הלכות איסורי ביאה",
  Forbidden_Foods: "מאכלות אסורות",
  Ritual_Slaughter: "הלכות שחיטה",
  Oaths: "הלכות נדרים",
  Vows: "הלכות נדרים",
  Nazirite: "הלכות נזירות",
  Heave_Offerings: "הלכות תרומות",
  Tithes: "הלכות מעשר",
  Second_Tithes: "הלכות מעשר שני",
  First_Fruits: "הלכות ביכורים",
  Gifts_to_the_Poor: "הלכות מתנות עניים",
  Heave_Offerings_of_Grain: "הלכות תרומות",
  Diverse_Species: "הלכות כלאים",
  Gifts_to_Priests: "הלכות מתנות כהונה",
  Firstlings: "הלכות בכורות",
  Substituted_Offerings: "הלכות פסולי המוקדשין",
  Paschal_Offering: "הלכות קרבן פסח",
  Festival_Offering: "הלכות חגיגה",
  Sacrifices_Rendered_Unfit: "הלכות פסולי המוקדשין",
  Procedure_for_Elucidation_of_Halakhot: "הלכות ממרים",
  Defilement_by_Leprosy: "הלכות טומאת צרעת",
  Defilement_of_Bed_and_Couch: "הלכות טומאת משכב ומושב",
  Other_Sources_of_Defilement: "הלכות שאר אבות הטומאות",
  Defilement_of_Foods: "הלכות טומאת אוכלין",
  Immersion_Pools: "הלכות מקוואות",
  Damages_to_Property: "הלכות נזקי ממון",
  Theft: "הלכות גניבה",
  Robbery_and_Lost_Property: "הלכות גזילה ואבידה",
  One_Who_Injures_His_Neighbor: "הלכות חובל ומזיק",
  Murderer_and_the_Preservation_of_Life: "הלכות רוצח ושמירת נפש",
  Sales: "הלכות מכירה",
  Ownerless_Property_and_Gifts: "הלכות זכייה ומתנה",
  Neighbors: "הלכות שכנים",
  Agents_and_Partners: "הלכות שלוחין ושותפין",
  Slaves: "הלכות עבדים",
  Hiring: "הלכות שכירות",
  Borrowing_and_Deposit: "הלכות הלואה ופיקדון",
  Creditor_and_Debtor: "הלכות מלוה ולוה",
  Plaintiff_and_Defendant: "הלכות טוען ונטען",
  Inheritances: "הלכות נחלות",
  The_Chosen_Temple: "הלכות בית הבחירה",
  Vessels_of_the_Sanctuary: "הלכות כלי המקדש",
  Admission_to_the_Sanctuary: "הלכות ביאת מקדש",
  Things_Forbidden_on_the_Altar: "הלכות איסורי מזבח",
  Sacrificial_Procedure: "הלכות מעשה הקרבנות",
  Daily_Offerings_and_Additional_Offerings: "הלכות תמידין ומוספין",
  Paschal_Offering2: "הלכות פסולי המוקדשין",
  Substitution: "הלכות תמורה",
  Sacrifices_Declared_Unfit: "הלכות פסולי המוקדשין",
  Ritual_Immersion: "הלכות מקוואות"
};

function rambamPathToHebrew(path: string): string | null {
  const decoded = decodeURIComponent(path).replaceAll("_", " ");
  const m = decoded.match(/^Mishneh Torah,?\s*([^.,]+)\.(.+)$/i);
  if (!m?.[1] || !m[2]) return null;
  const bookKey = m[1].trim();
  const bookHe = RAMBAM_BOOK[bookKey];
  if (!bookHe) return `רמב״ם — ${bookKey.replace(/_/g, " ")}, ${allDigitRunsToHebrew(m[2].replace(/:/g, "׃"))}`;
  const chap = allDigitRunsToHebrew(m[2].replace(/:/g, "׃"));
  return `${bookHe}, ${chap}`;
}

const AH_SECTION: Record<string, string> = {
  "Orach Chaim": "אורח חיים",
  "Yoreh De'ah": "יורה דעה",
  "Even HaEzer": "אבן העזר",
  "Choshen Mishpat": "חושן משפט"
};

function arukhHashulchanPathToHebrew(path: string): string | null {
  const decoded = decodeURIComponent(path).replaceAll("_", " ");
  const m = decoded.match(/^Arukh HaShulchan,?\s*([^.,]+)\.(.+)$/i);
  if (!m?.[1] || !m[2]) return null;
  const sec = AH_SECTION[m[1].trim()] ?? m[1].trim();
  return `ערוך השולחן — ${sec} ${m[2].replace(/-/g, "–").replace(/:/g, "׃")}`;
}

function kitzurPathToHebrew(path: string): string | null {
  const decoded = decodeURIComponent(path).replaceAll("_", " ");
  const m = decoded.match(/^Kitzur Shulchan Arukh\.([\d.]+)$/i) ?? decoded.match(/^Kitzur Shulchan Arukh ([\d.]+)$/i);
  if (!m?.[1]) return null;
  const parts = m[1].split(".").map((p) => Number(p)).filter((n) => !Number.isNaN(n));
  if (!parts.length) return "קיצור שולחן ערוך";
  const siman = numberToHebrew(parts[0]);
  if (parts.length >= 3) {
    const from = numberToHebrew(parts[1]);
    const to = numberToHebrew(parts[2]);
    return `קיצור שולחן ערוך — סימן ${siman}, הלכות ${from}–${to}`;
  }
  return `קיצור שולחן ערוך — סימן ${siman}`;
}

function sefariaPathFromBlock(block: string): string | null {
  const m = block.match(/sefaria\.org\/([^"?]+)\?lang=bi/i);
  if (!m?.[1]) return null;
  return decodeURIComponent(m[1]).replaceAll("_", " ");
}

function englishTractFromDetail(detail: string): string | null {
  const m = detail.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)\s*$/);
  if (!m?.[1] || !m[2]) return null;
  const key = m[1].replaceAll(" ", "");
  const he = BAVLI_MASECHTA[key] ?? BAVLI_MASECHTA[m[1].trim()];
  if (!he) return null;
  const n = Number(m[2]);
  if (Number.isNaN(n)) return null;
  return `${he} ${numberToHebrew(n)}`;
}

/** מחזיר פירוט בעברית לפי מזהה בלוק Hebcal ותוכן ה־HTML; אם אין המרה — מחזיר null. */
export function toHebrewDailyLearningDetail(id: string, block: string, englishFallback: string): string {
  const path = sefariaPathFromBlock(block);
  const eng = englishFallback.trim();

  if (id === "dafyomi" && path) {
    const h = bavliPathToHebrew(path);
    if (h) return h;
  }
  if ((id === "dirshuAmudYomi" || id === "dafWeekly") && path) {
    const h = bavliPathToHebrew(path);
    if (h) return h;
  }
  if ((id === "yerushalmi-vilna" || id === "yerushalmi-schottenstein") && path) {
    const h = bavliPathToHebrew(path);
    if (h) return h;
  }
  if (!path && (id === "yerushalmi-vilna" || id === "yerushalmi-schottenstein")) {
    const h = englishTractFromDetail(eng);
    if (h) return h;
  }

  if (id === "mishnayomi" && path?.toLowerCase().startsWith("mishnah")) {
    const h = mishnahPathToHebrew(path);
    if (h) return h;
  }
  if (id === "perekYomi" && path?.match(/^Mishnah/i)) {
    const h = mishnahPathToHebrew(path);
    if (h) return h;
  }

  if ((id === "nachyomi" || id === "tanakhYomi") && path) {
    const h = tanakhOrNachPathToHebrew(path);
    if (h) return h;
  }

  if (id === "dailyPsalms" && path) {
    const h = psalmsPathToHebrew(path);
    if (h) return h;
  }

  if ((id === "dailyRambam1" || id === "dailyRambam3") && path) {
    const h = rambamPathToHebrew(path);
    if (h) return h;
  }

  if (id === "arukhHaShulchanYomi" && path) {
    const h = arukhHashulchanPathToHebrew(path);
    if (h) return h;
  }

  if (id === "kitzurShulchanAruch" && path) {
    const h = kitzurPathToHebrew(path);
    if (h) return h;
  }

  if (id === "seferHaMitzvot") {
    const m = eng.match(/Day\s+(\d+)/i);
    if (m?.[1]) return `ספר המצוות — יום ${m[1]}`;
    return eng.replace(/^Day\s+/i, "יום ");
  }

  if (id === "chofetzChaim" || id === "shemiratHaLashon") {
    if (eng.includes("Rechilut") || eng.includes("רכילות")) {
      return eng.replace(/Hilchos\s+Rechilut/gi, "הלכות רכילות").replace(/Principle/gi, "עיקר");
    }
    return eng.replace(/Book\s+I/gi, "ספר א").replace(/Epilogue/gi, "חותם").replace(/Chasimas Hasefer/gi, "חותם הספר");
  }

  if (path?.toLowerCase().startsWith("mishnah")) {
    const h = mishnahPathToHebrew(path);
    if (h) return h;
  }

  return eng || englishFallback;
}
