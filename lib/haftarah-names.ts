/**
 * שמות הפטרות לפי מילות הפתיחה — טבלה מקומית לפי ציון Hebcal (אנגלית).
 * כשאין התאמה: נשארים רק עם המקור המתורגם.
 */

function normalizeCitation(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/,\s*/g, ", ")
    .replace(/\u2013|\u2014/g, "-")
    .trim();
}

const HAFTARAH_NAME_BY_CITE: Record<string, string> = {
  "amos 9:7-15": "הלא כבני כושיים",
  "ezekiel 1:1-28, 3:12": "ויהי בשלושים שנה",
  "ezekiel 20:2-20": "התשפט אתם",
  "ezekiel 22:1-16": "ואתה בן אדם המשפט",
  "ezekiel 28:25-29:21": "כה אמר ה' אלהים בקבצי",
  "ezekiel 36:16-36": "ויהי דבר ה' אלי",
  "ezekiel 36:16-38": "ויהי דבר ה' אלי",
  "ezekiel 37:1-14": "היתה עלי יד ה'",
  "ezekiel 37:15-28": "ואתה בן אדם קח לך עץ",
  "ezekiel 43:10-27": "אתה בן אדם הגד",
  "ezekiel 44:15-31": "והכהנים הלוים",
  "ezekiel 45:16-46:18": "כה אמר ה' אלהים",
  "ezekiel 45:18-46:15": "כה אמר ה' אלהים",
  "ezekiel 45:18-46:16": "כה אמר ה' אלהים",
  "hosea 2:1-22": "והיה מספר בני ישראל",
  "hosea 11:7-12:12": "ואל רעמים",
  "hosea 12:13-14:10": "ויברח יעקב",
  "hosea 14:2-10": "שובה ישראל",
  "i kings 1:1-31": "והמלך דוד זקן",
  "i kings 2:1-12": "ויקרבו ימי דוד",
  "i kings 3:15-4:1": "ויקץ שלמה",
  "i kings 5:26-6:13": "וה' נתן חכמה",
  "i kings 7:13-26": "וישלח המלך שלמה",
  "i kings 7:40-50": "ויעש חירום",
  "i kings 7:51-8:21": "ותשלם כל המלאכה",
  "i kings 18:1-39": "ויהי ימים רבים",
  "i kings 18:20-39": "וישלח אחאב בכל בני ישראל",
  "i kings 18:46-19:21": "ויד ה' היתה אל אליהו",
  "i samuel 1:1-2:10": "ויהי איש אחד מן הרמתים",
  "i samuel 11:14-12:22": "ויאמר שמואל אל העם",
  "i samuel 15:1-34": "ויאמר שמואל אל שאול",
  "i samuel 15:2-34": "כה אמר ה' צבאות פקדתי",
  "i samuel 20:18-42": "ויאמר לו יהונתן מחר חדש",
  "ii kings 4:1-23": "ואשה אחת מנשי בני הנביאים",
  "ii kings 4:1-37": "ואשה אחת מנשי בני הנביאים",
  "ii kings 4:42-5:19": "ואיש בא מבעל שלישה",
  "ii kings 7:3-20": "וארבעה אנשים",
  "ii kings 11:17-12:17": "ויכרת יהוידע",
  "ii kings 12:1-17": "בן שבע שנים יהואש",
  "ii samuel 6:1-19": "ויסף עוד דוד",
  "ii samuel 6:1-7:17": "ויסף עוד דוד",
  "ii samuel 22:1-51": "וידבר דוד",
  "isaiah 1:1-27": "חזון ישעיהו",
  "isaiah 6:1-13": "בשנת מות המלך עזיהו",
  "isaiah 6:1-7:6, 9:5-6": "בשנת מות המלך עזיהו",
  "isaiah 10:32-12:6": "עוד היום בנוב",
  "isaiah 27:6-28:13, 29:22-23": "הימים באים",
  "isaiah 40:1-26": "נחמו",
  "isaiah 40:27-41:16": "למה תאמר יעקב",
  "isaiah 42:5-43:10": "כה אמר האל",
  "isaiah 43:21-44:23": "עם זו יצרתי",
  "isaiah 49:14-51:3": "ותאמר ציון",
  "isaiah 51:12-52:12": "אנכי אנכי",
  "isaiah 54:1-10": "רני עקרה",
  "isaiah 54:1-55:5": "רני עקרה",
  "isaiah 54:11-55:5": "ענייה סוערה",
  "isaiah 55:6-56:8": "דרשו ה'",
  "isaiah 60:1-22": "קומי אורי",
  "isaiah 61:10-63:9": "שוש אשיש",
  "isaiah 66:1-24": "השמים כסאי",
  "jeremiah 1:1-2:3": "דברי ירמיהו",
  "jeremiah 2:4-28, 3:4": "שמעו דבר ה'",
  "jeremiah 2:4-28, 4:1-2": "שמעו דבר ה'",
  "jeremiah 7:21-8:3, 9:22-23": "כה אמר ה' צבאות",
  "jeremiah 16:19-17:14": "ה' עזי ומעזי",
  "jeremiah 31:1-19": "מצא חן במדבר",
  "jeremiah 32:6-27": "היה דבר ה'",
  "jeremiah 34:8-22, 33:25-26": "הדבר אשר היה",
  "jeremiah 46:13-28": "הדבר אשר דבר ה'",
  "joshua 1:1-18": "ויהי אחרי מות משה",
  "joshua 2:1-24": "וישלח יהושע",
  "joshua 3:5-7, 5:2-6:1, 6:27": "ויאמר יהושע אל העם",
  "joshua 5:2-6:1, 6:27": "בעת ההיא אמר ה'",
  "judges 4:4-5:31": "ודבורה אשה נביאה",
  "judges 5:1-31": "ותשר דבורה",
  "judges 11:1-33": "ויפתח הגלעדי",
  "judges 13:2-25": "ויהי איש אחד מצרעה",
  "malachi 1:1-2:7": "משא דבר ה'",
  "malachi 3:4-24": "והערבה לה'",
  "micah 5:6-6:8": "והיה שארית יעקב",
  "obadiah 1:1-21": "חזון עובדיה",
  "zechariah 2:14-4:7": "רני ושמחי",
  "zechariah 14:1-21": "הנה יום בא לה'"
};

const CONSOLATION_NAMES = ["נחמו", "ותאמר ציון", "ענייה סוערה", "אנכי אנכי", "רני עקרה", "קומי אורי", "שוש אשיש"] as const;
const ADMONITION_NAMES = ["דברי ירמיהו", "שמעו דבר ה'", "חזון ישעיהו"] as const;

export function lookupHaftarahName(
  citation: string | null | undefined,
  theme?: { consolation?: number | string; admonition?: number }
): string | null {
  if (citation?.trim()) {
    const named = HAFTARAH_NAME_BY_CITE[normalizeCitation(citation)];
    if (named) return named;
  }
  if (typeof theme?.admonition === "number" && theme.admonition >= 1 && theme.admonition <= 3) {
    return ADMONITION_NAMES[theme.admonition - 1] ?? null;
  }
  if (typeof theme?.consolation === "number" && theme.consolation >= 1 && theme.consolation <= 7) {
    return CONSOLATION_NAMES[theme.consolation - 1] ?? null;
  }
  return null;
}
