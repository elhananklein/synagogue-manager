"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { gabbaiWallPreviewHref } from "@/lib/handheld";

const NAV = [
  { id: "start", label: "התחלה" },
  { id: "prayers", label: "תפילות" },
  { id: "bulletin", label: "מודעות" },
  { id: "shabbat", label: "שבת וחג" },
  { id: "people", label: "מתפללים" },
  { id: "aliyot", label: "עליות" },
  { id: "look", label: "מראה" },
  { id: "settings", label: "הגדרות" },
  { id: "examples", label: "דוגמאות" }
] as const;

const WALL_EXAMPLES = [
  { src: "/guide/wall-home.png", title: "מסך ראשי", caption: "פרשה, תאריך, תפילות והתפילה הבאה." },
  { src: "/guide/wall-info.png", title: "מידע מרכזי", caption: "אותם פרטים, מוגדלים." },
  { src: "/guide/wall-main.png", title: "שעון", caption: "שעון גדול והתפילה הבאה." },
  { src: "/guide/wall-omer.png", title: "ספירת העומר", caption: "מופיע רק בימי העומר, אם הדלקתם את המסך." },
  { src: "/guide/wall-next.png", title: "הלכה יומית", caption: "סעיף היום, לפי מה שבחרתם בהגדרות." },
  { src: "/guide/wall-learning.png", title: "לימוד יומי", caption: "הספרים שסימנתם במראה המסך." },
  { src: "/guide/wall-prayers.png", title: "זמני תפילות", caption: "רשימת התפילות של היום." },
  { src: "/guide/wall-schedule.png", title: "לוח זמנים מלא", caption: "תפילות וגם זמני היום, לפי הסימונים." },
  { src: "/guide/wall-shabbat.png", title: "שבת וחגים", caption: "בשישי, בשבת וביום טוב: פרשה או שם החג, כניסה/יציאה, סדר היום." },
  { src: "/guide/wall-bulletin.png", title: "לוח מודעות", caption: "ההודעות שפרסמתם. אם אין — המסך לא יופיע." }
] as const;

function Where({ wall, phone, gabbai, none }: { wall?: string; phone?: string; gabbai?: string; none?: string }) {
  return (
    <div className="guide-where">
      {wall ? <span className="guide-pill guide-pill--wall">על הקיר: {wall}</span> : null}
      {phone ? <span className="guide-pill guide-pill--phone">בטלפון: {phone}</span> : null}
      {gabbai ? <span className="guide-pill guide-pill--gabbai">אצל הגבאי: {gabbai}</span> : null}
      {none ? <span className="guide-pill guide-pill--none">{none}</span> : null}
    </div>
  );
}

function Change({ field, meaning }: { field: string; meaning: string }) {
  return (
    <div className="guide-change">
      <strong>{field}</strong>
      <p>{meaning}</p>
    </div>
  );
}

function LivePair({ synagogueId }: { synagogueId: string }) {
  const [open, setOpen] = useState(false);
  const wall = `/display?synagogueId=${encodeURIComponent(synagogueId)}`;
  const wallPreview = gabbaiWallPreviewHref(synagogueId);
  const mobile = `/m/display?synagogueId=${encodeURIComponent(synagogueId)}&preview=mobile`;
  return (
    <div className="guide-live">
      <button type="button" className="guide-live-btn" onClick={() => setOpen((v) => !v)}>
        {open ? "הסתרת התצוגה החיה" : "הציגו את המסך החי של בית הכנסת שלכם"}
      </button>
      {open ? (
        <div className="guide-live-stage">
          <div>
            <div className="guide-iframe-wall">
              <iframe title="תצוגת קיר חיה" src={wall} />
            </div>
            <p className="guide-shot">
              <span className="guide-pill guide-pill--wall">קיר חי</span>
            </p>
          </div>
          <div>
            <div className="guide-iframe-phone">
              <iframe title="תצוגת טלפון חיה" src={mobile} />
            </div>
            <p className="guide-shot">
              <span className="guide-pill guide-pill--phone">טלפון חי</span>
            </p>
          </div>
        </div>
      ) : null}
      <div className="guide-links">
        <a href={wallPreview} target="_blank" rel="noreferrer">
          פתיחת הקיר בחלון חדש
        </a>
        <a className="guide-links--ghost" href={mobile} target="_blank" rel="noreferrer">
          פתיחת הטלפון בחלון חדש
        </a>
      </div>
    </div>
  );
}

export function GabbaiGuide({ synagogueId }: { synagogueId: string }) {
  const [active, setActive] = useState<string>("start");
  const base = `/admin/gabbai/${encodeURIComponent(synagogueId)}`;

  useEffect(() => {
    const nodes = NAV.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => Boolean(el));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-18% 0px -70% 0px", threshold: [0.15, 0.4, 0.7] }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="guide-page">
      <h1 className="gabbai-page-title">הסבר פשוט למערכת</h1>
      <p className="guide-intro">
        לפי סדר מסכי הניהול: מה כל שינוי עושה, ועל מי הוא משפיע. צילומי דוגמה של הקיר והטלפון — בתחתית הדף.
      </p>

      <nav className="guide-toc" aria-label="נושאי ההסבר">
        {NAV.map((item) => (
          <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? "true" : undefined}>
            {item.label}
          </a>
        ))}
      </nav>

      <section className="guide-section" id="start">
        <h2>לפני שמתחילים</h2>
        <p>יש שלושה מקומות. אתם עובדים באחד, והציבור רואה בשניים האחרים.</p>
        <div className="guide-worlds">
          <div className="guide-world">
            <strong>הקיר</strong>
            <span>הטלוויזיה. המסכים מתחלפים לבד, לפי מה שהדלקתם ב«מראה המסך».</span>
          </div>
          <div className="guide-world">
            <strong>הטלפון</strong>
            <span>האפליקציה של המתפלל. אותם זמנים והודעות, בכרטיסים שגוללים.</span>
          </div>
          <div className="guide-world">
            <strong>אתם</strong>
            <span>כאן משנים. שמירה במסך הזה מעדכנת את הקיר ואת הטלפון — בלי לגעת בטלוויזיה.</span>
          </div>
        </div>
        <div className="guide-admin">
          <strong>כלל אחד</strong>
          <p>כל מסך נשמר לבד. שיניתם תפילות? שמירה במסך התפילות. שינוי במראה לא נשמר יחד עם תפילות.</p>
        </div>
        <Change
          field="לאיזה מניין?"
          meaning="אם יש כמה מניינים — בוחרים למעלה לפני מראה, תפילות או שבתות וחגים. כל מניין נשמר בנפרד. על הקיר: ?minyan=1 לראשון, 2 לשני."
        />
        <div className="guide-links">
          <Link href={base}>חזרה למסך הראשי</Link>
        </div>
      </section>

      <section className="guide-section" id="prayers">
        <h2>זמני תפילה</h2>
        <p>המסך הזה קובע מתי מתפללים. זה מה שבונה את «התפילה הבאה» ואת הרשימות.</p>
        <Where wall="התפילה הבאה, זמני תפילות, לוח זמנים, מסך שבת אם אין סדר ידני" phone="אותן רשימות, עם סימון «הבא»" />
        <div className="guide-links">
          <Link href={`${base}/prayers`}>פתיחת זמני תפילה</Link>
        </div>
        <Change
          field="הוספת תפילה / מחק"
          meaning="מוסיפים או מסירים שורה. בלי שורה — התפילה לא תופיע באותו יום."
        />
        <Change
          field="סוג התפילה"
          meaning="בחול: סליחות, שחרית, מנחה, ערבית. בשבת: מנחה ערב שבת וקבלת שבת, שחרית שבת, מנחה שבת, ערבית מוצ״ש. הסדר על המסך לפי סדר היום."
        />
        <Change
          field="ימים"
          meaning="באילו ימים השורה חלה. שישי בבוקר יכול לכלול סליחות ושחרית; מנחה וערבית של חול מוחלפות בערב שבת כשיש תפילות שבת."
        />
        <Change
          field="שעה קבועה"
          meaning="אותה שעה כל יום מסומן. למשל שחרית 07:00."
        />
        <Change
          field="לפי זריחה / שקיעה"
          meaning="השעה זזה עם הזמן ההלכתי של המיקום. לדוגמה 20 דקות אחרי השקיעה. אפשר לעגל לחמש דקות."
        />
        <Change
          field="לפי פרשת השבוע"
          meaning="רק למנחה ולערבית של חול. השעה מגיעה מטבלת הפרשות למטה — נשמרת בלחצן נפרד."
        />
        <p className="guide-note">אם מילאתם לוח שבתות וחגים, המסך על הקיר מציג אותו במקום רשימת התפילות.</p>
      </section>

      <section className="guide-section" id="bulletin">
        <h2>לוח מודעות</h2>
        <p>הודעה לציבור: שיעור, אזכרה, בקשה. טקסט או תמונה.</p>
        <Where wall="מסך «לוח מודעות» — רק אם הוא דלוק במראה" phone="כרטיס «לוח מודעות» בגלילה" />
        <div className="guide-links">
          <Link href={`${base}/bulletin`}>פתיחת לוח המודעות</Link>
        </div>
        <Change field="טקסט או תמונה" meaning="מה יוצג. תמונה ממלאת את מסך המודעות על הקיר." />
        <Change field="מתאריך / עד תאריך" meaning="מחוץ לטווח ההודעה לא מוצגת. אפשר בלי הגבלה." />
        <Change
          field="מוצג בלוח המודעות"
          meaning="כיבוי = ההודעה שמורה אצלכם ולא יוצאת לציבור. אם אין אף הודעה מוצגת — מסך המודעות על הקיר לא מופיע."
        />
        <p className="guide-note">המודעות משותפות לכל המניינים. אבל המסך עצמו חייב להיות «מוצג» במראה של אותו מניין.</p>
      </section>

      <section className="guide-section" id="shabbat">
        <h2>שבתות וחגים</h2>
        <p>רשימה חופשית: מה קורה בשבת או בחג, לפי הסדר.</p>
        <Where
          wall="מסך שבת וחגים — בשישי, בשבת וביום טוב"
          phone="כרטיס שבת וחגים — בשישי, בשבת וביום טוב"
        />
        <div className="guide-links">
          <Link href={`${base}/shabbat`}>פתיחת לוח שבתות וחגים</Link>
        </div>
        <Change field="שעה" meaning="לא חובה. אם יש שעה היא מוצגת ליד התוכן, גדולה על הקיר." />
        <Change field="מה קורה" meaning="הטקסט שהציבור רואה. למשל קבלת שבת, קריאת התורה, קידוש." />
        <Change field="מוצג בתצוגה" meaning="אפשר להכין שורה בלי להראות אותה עדיין." />
        <Change
          field="בלי סדר ידני"
          meaning="אם הרשימה ריקה, המסך מציג את זמני התפילות ששמרתם במסך התפילות."
        />
        <p>שם ההפטרה ונוסח ברכת השנים על הקיר מגיעים מנוסח התפילה של המניין, בהגדרות בית הכנסת.</p>
      </section>

      <section className="guide-section" id="people">
        <h2>מתפללים</h2>
        <p>כרטיס לכל אדם בבית הכנסת. לא מוצג על הטלוויזיה.</p>
        <Where gabbai="רשימה, כרטיס, ייבוא, ואישור נרשמים" none="לא על הקיר ולא במסך הזמנים בטלפון" />
        <div className="guide-links">
          <Link href={`${base}/congregants`}>פתיחת המתפללים</Link>
        </div>
        <Change field="הוספה / עריכה" meaning="שם, גבר/אשה, אב ואם, כהן/לוי/ישראל, תאריך לידה, טלפון, מניין, האם מקבל עלייה." />
        <Change
          field="יארצייט"
          meaning="סגור כברירת מחדל. «הוספת יארצייט» פותח שורה: קרבה (שבעה קרובים, או סבא/סבתא), שם הנפטר אם רוצים, ותאריך לועזי או עברי. גם בטופס שהמתפלל ממלא בעצמו."
        />
        <Change
          field="בן משפחה"
          meaning="מקשרים מתפלל רשום כבן, בת, בעל או אשה. אפשר גם לפתוח כרטיס חדש ולקשר מיד."
        />
        <Change field="ייבוא מאקסל" meaning="הרבה כרטיסים בבת אחת. בודקים אחרי הייבוא שכל שורה נקלטה." />
        <Change
          field="קישור למילוי עצמי"
          meaning="שולחים למתפלל. הוא ממלא בטלפון, ונכנס כ«ממתין» עד שתאשרו. בלי אישור הוא לא ברשימה הרגילה ולא בעליות."
        />
        <p className="guide-note guide-note--mute">זה בשביל עליות, ובעתיד תזכורות. לא משפיע על הקיר.</p>
      </section>

      <section className="guide-section" id="aliyot">
        <h2>עליות</h2>
        <p>אחרי שבת או חג — מסמנים מי עלה לתורה. לפי מניין, ופרשה או חג (עם השנה).</p>
        <Where gabbai="גיליון עליות" none="לא על הקיר ולא בטלפון של הציבור" />
        <div className="guide-links">
          <Link href={`${base}/aliyot`}>פתיחת העליות</Link>
        </div>
        <Change
          field="פרשה / חג"
          meaning="הרישום לפי שם הפרשה או החג והשנה, למשל «נצבים-וילך תשפ״ו». התאריך הלועזי כתוב מתחת. החצים מעבירים לפרשה או לחג הקודם והבא."
        />
        <Change field="בחירת עולה" meaning="חיפוש לפי שם או טלפון מתוך המתפללים של אותו מניין." />
        <Change
          field="העולה לא ברשימה"
          meaning="נפתח חלון להוספת מתפלל בלי לעזוב את הדף, ואז חוזרים לאותה עלייה."
        />
        <Change field="אין כהן" meaning="בוחרים ישראל בכהן. נרשם שעלה במקומו." />
        <Change field="הוספת עלייה" meaning="עלייה נוספת מעבר לרשימת ברירת המחדל. לא לשכוח «שמירת העליות»." />
      </section>

      <section className="guide-section" id="look">
        <h2>מראה המסך</h2>
        <p>איך הקיר נראה, ואילו מסכים מתחלפים. לכל מניין בנפרד.</p>
        <Where wall="הכל כאן משפיע על הטלוויזיה" phone="רק הפונט, ורשימת התפילות/הזמנים" />
        <div className="guide-links">
          <Link href={`${base}/look`}>פתיחת מראה המסך</Link>
        </div>
        <Change
          field="סגנון"
          meaning="קלאסי, מודרני, מינימלי, עץ וכסף, כחול מלכותי, בולט מאוד. משנה פריסה וצבעים על הקיר בלבד. הטלפון לא מחליף סגנון."
        />
        <Change field="צבעים" meaning="רק ב«בולט מאוד»: דיו ושנהב, כחול וזהב, או בורדו. רק על הקיר." />
        <Change field="פונט" meaning="הגופן על הקיר וגם בטלפון." />
        <Change
          field="הודעה בתחתית המסך"
          meaning="פס קטן בכל מסכי הקיר, ובתחתית הגלילה בטלפון. למשל «אין לדבר בשעת התפילה». עד 120 תווים."
        />
        <Change
          field="מה מוצג במסך הראשי"
          meaning="«רק זמני תפילות» — רשימה קצרה. «תפילות וגם זמני היום» — מוסיף זריחה, שקיעה וכו׳ לפי הסימונים למטה. בטלפון יש מתג דומה."
        />
        <Change
          field="לימוד יומי — אילו ספרים"
          meaning="מה יופיע במסך «לימוד יומי» על הקיר ובכרטיס בטלפון. דף יומי מופיע גם במסך הראשי תמיד."
        />
        <Change
          field="מסכים מתחלפים"
          meaning="כל שורה = מסך על הקיר. «מוצג» מדליק או מכבה. «שניות» כמה זמן הוא נשאר. החצים משנים סדר. בטלפון אין החלפה — הכול בגלילה, ומסכים כפולים מוסתרים אם יש מסך ראשי."
        />
        <Change
          field="צפייה במסך"
          meaning="במראה המסך או ב«עוד». פותח את תצוגת הקיר כמו בטלוויזיה — גם אם אתם בטלפון. לא פותח את אפליקציית המתפלל, ולא משנה אותה. בנוחות סובבו לרוחב. «חזרה לניהול» מחזיר לכאן."
        />
        <p className="guide-note">מסך שבת מוצג רק בשישי ובשבת, גם אם הוא דלוק. מסך עומר — רק בימי העומר.</p>
      </section>

      <section className="guide-section" id="settings">
        <h2>הגדרות בית הכנסת</h2>
        <p>שם הבית, והגדרות לכל מניין: שם ונוסח התפילה.</p>
        <div className="guide-links">
          <Link href={`${base}/settings`}>פתיחת ההגדרות</Link>
        </div>
        <Change
          field="שם בית הכנסת"
          meaning="הכותרת על הקיר, בטלפון, ובשם האפליקציה כשמתקינים. אחרי שינוי — «שמירת ההגדרות»."
        />
        <Change
          field="לוגו"
          meaning="נשמר מיד. לא מופיע על הקיר. זה האייקון כשמתקינים את האפליקציה בטלפון. מי שכבר התקין צריך להסיר ולהתקין מחדש."
        />
        <Change
          field="מניינים — שם / הוספה / מחיקה"
          meaning="השם בכותרת הקיר ובבורר בטלפון. מחיקה מוחקת גם את זמני התפילה של אותו מניין. מניין חדש צריך אחר כך מראה ותפילות משלו."
        />
        <Change
          field="נוסח התפילה"
          meaning="לכל מניין: אשכנזי / ספרדי / חב״ד. מכאן נגזרים שם ההפטרה במסך השבת, ונוסח ברכת השנים על הקיר: ספרדי — «ברכנו» בקיץ ו«ברך עלינו» בחורף; אשכנזי וחב״ד — «ותן ברכה» / «ותן טל ומטר לברכה». אם לא בחרתם — אשכנזי."
        />
        <Change
          field="מאיפה מגיעה ההלכה"
          meaning="«משולחן ערוך» — הלכת היום מתעדכנת לבד. «קיצור» או «הוזנו ידנית» — לפי מה שהזנתם, מתאריך ההתחלה, בתקציר או במלא. על הקיר רק אם מסך ההלכה דלוק במראה. בטלפון תמיד אפשר לפתוח בהלכה מתקפלת."
        />
      </section>

      <section className="guide-section" id="examples">
        <h2>דוגמאות: איך זה נראה לציבור</h2>
        <p>צילומים מבית כנסת לבדיקות. אצלכם הצבעים והסדר לפי מה ששמרתם במראה.</p>
        <LivePair synagogueId={synagogueId} />

        <h3>מסכי הקיר, לפי הסדר במערכת</h3>
        <div className="guide-wall-gallery">
          {WALL_EXAMPLES.map((item) => (
            <figure key={item.src} className="guide-shot">
              <div className="guide-frame guide-frame--wall">
                <img
                  src={`${item.src}?v=2`}
                  alt={item.title}
                  onError={(e) => {
                    e.currentTarget.closest("figure")?.setAttribute("hidden", "");
                  }}
                />
              </div>
              <figcaption>
                <strong>{item.title}</strong>
                {item.caption}
              </figcaption>
            </figure>
          ))}
        </div>

        <h3>הטלפון — מהרואים אחרי שנכנסים לבית הכנסת, עד הסוף</h3>
        <p>אין החלפת מסכים. גוללים למטה: כותרת, תפילה הבאה, כרטיסים, הלכה, לימוד, והודעה בתחתית.</p>
        <figure className="guide-shot guide-shot--phone-full">
          <div className="guide-frame guide-frame--phone">
            <img src="/guide/mobile-full.png?v=2" alt="תצוגת הטלפון במלואה, כולל גלילה למטה" />
          </div>
          <figcaption>צילום מלא של מסך הטלפון, מהכותרת עד הקישורים למטה.</figcaption>
        </figure>
      </section>
    </div>
  );
}
