"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const NAV = [
  { id: "start", label: "התחלה" },
  { id: "screens", label: "קיר וטלפון" },
  { id: "settings", label: "הגדרות" },
  { id: "look", label: "מראה" },
  { id: "prayers", label: "תפילות" },
  { id: "bulletin", label: "מודעות" },
  { id: "shabbat", label: "שבת" },
  { id: "people", label: "מתפללים" },
  { id: "aliyot", label: "עליות" },
  { id: "app", label: "אפליקציה" },
  { id: "faq", label: "שאלות" }
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

function ShotPair({
  wallSrc,
  mobileSrc,
  wallCaption,
  mobileCaption
}: {
  wallSrc: string;
  mobileSrc: string;
  wallCaption: string;
  mobileCaption: string;
}) {
  return (
    <div className="guide-pair">
      <figure className="guide-shot">
        <div className="guide-frame guide-frame--wall">
          <img src={wallSrc} alt={wallCaption} />
        </div>
        <figcaption>{wallCaption}</figcaption>
      </figure>
      <figure className="guide-shot">
        <div className="guide-frame guide-frame--phone">
          <img src={mobileSrc} alt={mobileCaption} />
        </div>
        <figcaption>{mobileCaption}</figcaption>
      </figure>
    </div>
  );
}

function LivePair({ synagogueId }: { synagogueId: string }) {
  const [open, setOpen] = useState(false);
  const wall = `/display?synagogueId=${encodeURIComponent(synagogueId)}`;
  const mobile = `/m/display?synagogueId=${encodeURIComponent(synagogueId)}`;
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
        <a href={wall} target="_blank" rel="noreferrer">
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
        כאן כתוב מה כל כפתור עושה — בשפה פשוטה, עם תמונות. אפשר לדלג לנושא למעלה, או פשוט לגלול.
      </p>

      <nav className="guide-toc" aria-label="נושאי ההסבר">
        {NAV.map((item) => (
          <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? "true" : undefined}>
            {item.label}
          </a>
        ))}
      </nav>

      <section className="guide-section" id="start">
        <h2>איך המערכת בנויה</h2>
        <p>יש שלושה מקומות. אתם עובדים באחד, והציבור רואה בשניים האחרים.</p>
        <div className="guide-worlds">
          <div className="guide-world">
            <strong>1. הקיר</strong>
            <span>הטלוויזיה בבית הכנסת. המסכים מתחלפים לבד. זה מה שרואים מי שעומד בתפילה.</span>
          </div>
          <div className="guide-world">
            <strong>2. הטלפון</strong>
            <span>האפליקציה של המתפלל. אותם זמנים ואותן הודעות, בגלילה נוחה בטלפון.</span>
          </div>
          <div className="guide-world">
            <strong>3. אתם — הגבאי</strong>
            <span>כאן משנים. מה ששמרתם כאן מגיע לקיר ולטלפון. לא צריך לגעת בטלוויזיה.</span>
          </div>
        </div>
        <div className="guide-admin">
          <strong>כלל אחד חשוב</strong>
          <p>כל מסך נשמר לבד. שיניתם זמני תפילה? לחצו שמירה באותו מסך. שינוי ב«מראה» לא נשמר יחד עם «תפילות».</p>
        </div>
        <p>אם יש כמה מניינים — בחרו למעלה «לאיזה מניין?» לפני שמשנים מראה, תפילות או סדר שבת. כל מניין יכול להיראות אחרת.</p>
        <div className="guide-links">
          <Link href={base}>חזרה למסך הראשי</Link>
          <a className="guide-links--ghost" href={`/display?synagogueId=${encodeURIComponent(synagogueId)}`} target="_blank" rel="noreferrer">
            צפייה בקיר עכשיו
          </a>
        </div>
      </section>

      <section className="guide-section" id="screens">
        <h2>איך נראה הקיר ואיך נראה הטלפון</h2>
        <p>אותו בית כנסת, שני מראות. בקיר זה מסך גדול שמתחלף. בטלפון גוללים למטה ורואים כרטיסים.</p>
        <ShotPair
          wallSrc="/guide/wall-main.png"
          mobileSrc="/guide/mobile-display.png"
          wallCaption="כך זה נראה על הקיר: שעון גדול, שם בית הכנסת, והתפילה הבאה."
          mobileCaption="אותו מידע בטלפון: שעון, תפילה הבאה, והודעה למטה."
        />
        <ShotPair
          wallSrc="/guide/wall-next.png"
          mobileSrc="/guide/mobile-home.png"
          wallCaption="עוד מסך על הקיר: הלכה יומית. המסכים מתחלפים לבד, לפי מה שהדלקתם במראה."
          mobileCaption="בטלפון בוחרים בית כנסת ומתקינים למסך הבית. אחר כך נכנסים ישר לזמנים."
        />
        <h3>מה זהה ומה שונה</h3>
        <ul>
          <li>זמני תפילה, פרשה, הלכה, מודעות וסדר שבת — מגיעים מאותו מקום.</li>
          <li>צבעים וסגנון של הקיר (קלאסי, בולט מאוד וכו׳) משפיעים רק על הטלוויזיה.</li>
          <li>בטלפון אפשר לדפדף לימים אחרים. על הקיר תמיד רואים את היום הזה.</li>
          <li>הלוגו לא מופיע על הקיר. הוא רק לאייקון של האפליקציה בטלפון.</li>
        </ul>
        <LivePair synagogueId={synagogueId} />
      </section>

      <section className="guide-section" id="settings">
        <h2>הגדרות בית הכנסת</h2>
        <p>כאן משנים דברים ששייכים לכל הבית, לא למניין אחד.</p>
        <div className="guide-links">
          <Link href={`${base}/settings`}>פתיחת ההגדרות</Link>
        </div>

        <h3>שם בית הכנסת</h3>
        <Where wall="בכותרת של כל מסך" phone="בכותרת ובשם האפליקציה" />
        <p>זה השם שרואים למעלה על הקיר ועל הטלפון. אחרי שינוי — לחצו «שמירת ההגדרות».</p>

        <h3>לוגו</h3>
        <Where phone="אייקון כשמתקינים את האפליקציה" none="לא מופיע על הקיר" />
        <p>העלאת לוגו נשמרת מיד. מי שכבר התקין את האפליקציה צריך להסיר ולהתקין מחדש כדי לראות אייקון חדש.</p>

        <h3>מניינים</h3>
        <Where wall="השם בכותרת; אפשר לבחור מניין בכתובת" phone="בורר מניין למעלה" />
        <p>אפשר להוסיף מניין או למחוק. מחיקה מוחקת גם את זמני התפילה של אותו מניין. מניין חדש צריך אחר כך מראה ותפילות משלו.</p>

        <h3>מאיפה מגיעה ההלכה</h3>
        <Where wall="מסך «הלכה יומית» אם הוא דלוק" phone="תמיד אפשר לפתוח «הלכה יומית» בגלילה" />
        <ul>
          <li>«משולחן ערוך» — הלכת היום מתעדכנת לבד.</li>
          <li>«קיצור שולחן ערוך» או «הוזנו ידנית» — לפי מה שהזנתם, עם תקציר או מלא.</li>
        </ul>
        <figure className="guide-shot">
          <div className="guide-frame guide-frame--wall">
            <img src="/guide/wall-next.png" alt="מסך הלכה יומית על הקיר" />
          </div>
          <figcaption>מסך הלכה יומית על הקיר. בטלפון אותה הלכה נפתחת בלחיצה, בלי לתפוס את כל המסך.</figcaption>
        </figure>
        <p className="guide-note">בטלפון ההלכה לא תופסת מסך שלם. היא מתקפלת, ופותחים בלחיצה.</p>
      </section>

      <section className="guide-section" id="look">
        <h2>מראה המסך</h2>
        <p>כאן מחליטים איך הקיר נראה, ואילו מסכים מתחלפים. כל מניין נשמר בנפרד.</p>
        <div className="guide-links">
          <Link href={`${base}/look`}>פתיחת מראה המסך</Link>
        </div>

        <h3>סגנון וצבעים</h3>
        <Where wall="כל המסך: צבעים, כותרת, שעון" none="הטלפון לא משנה צבע לפי הסגנון" />
        <p>יש קלאסי, מודרני, מינימלי, עץ וכסף, כחול מלכותי, ובולט מאוד. ב«בולט מאוד» אפשר גם לבחור פלטת צבעים.</p>

        <h3>פונט</h3>
        <Where wall="כן" phone="כן, רק הגופן" />

        <h3>מנהג הפטרה</h3>
        <Where wall="שם ומקור ההפטרה במסך שבת" none="בטלפון אין שורת הפטרה נפרדת" />
        <p>אשכנזי, ספרדי או חב״ד. אם לא בחרתם — אשכנזי.</p>

        <h3>הודעה בתחתית המסך</h3>
        <Where wall="פס למטה בכל המסכים" phone="הודעה בתחתית הגלילה" />
        <p>למשל: «אין לדבר בשעת התפילה». עד 120 תווים.</p>
        <ShotPair
          wallSrc="/guide/wall-main.png"
          mobileSrc="/guide/mobile-display.png"
          wallCaption="הפס התחתון על הקיר מגיע מהשדה «הודעה בתחתית המסך»."
          mobileCaption="אותה הודעה בטלפון, למטה אחרי הכרטיסים."
        />

        <h3>מה מוצג במסך הראשי</h3>
        <Where wall="רשימת תפילות, או גם זריחה ושקיעה" phone="ברירת מחדל תפילות; יש מתג «לוח זמנים מלא»" />
        <p>«רק זמני תפילות» — קצר וברור. «תפילות וגם זמני היום» — מוסיף זריחה, שקיעה וכו׳ לפי הסימונים.</p>

        <h3>לימוד יומי</h3>
        <Where wall="מסך «לימוד יומי» אם דלקתם אותו" phone="כרטיס «לימוד יומי»" />
        <p>כאן בוחרים אילו ספרים יופיעו (דף יומי, משנה, רמב״ם…). דף יומי מופיע גם במסך הראשי תמיד.</p>

        <h3>מסכים מתחלפים</h3>
        <Where wall="הרוטטור על הטלוויזיה" phone="כרטיסים בגלילה" />
        <p>כל שורה היא מסך: ראשי, שעון, הלכה, שבת, מודעות… «מוצג» מדליק או מכבה. «שניות» כמה זמן הוא נשאר על הקיר. החצים משנים סדר.</p>
        <div className="guide-grid guide-grid--3">
          <div className="guide-card">
            <h3>מסך ראשי</h3>
            <p>פרשה, תאריך, תפילות, התפילה הבאה.</p>
          </div>
          <div className="guide-card">
            <h3>שעון</h3>
            <p>שעון גדול + התפילה הבאה. נוח באמצע התפילה.</p>
          </div>
          <div className="guide-card">
            <h3>הלכה / לימוד</h3>
            <p>סעיפי הלכה, או רשימת ספרי היום.</p>
          </div>
          <div className="guide-card">
            <h3>זמני תפילות</h3>
            <p>רשימה גדולה של שחרית, מנחה, ערבית.</p>
          </div>
          <div className="guide-card">
            <h3>שבת</h3>
            <p>רק בשישי ושבת: פרשה, כניסה/יציאה, סדר היום.</p>
          </div>
          <div className="guide-card">
            <h3>לוח מודעות</h3>
            <p>ההודעות שפרסמתם. אם כבית — המסך לא יופיע.</p>
          </div>
        </div>
        <p className="guide-note">בטלפון אין «החלפת מסכים». אם הדלקתם מסך ראשי, חלק מהמסכים הכפולים מוסתרים כדי לא לחזור על אותו דבר.</p>
      </section>

      <section className="guide-section" id="prayers">
        <h2>זמני תפילה</h2>
        <p>כאן קובעים מתי מתפללים. זה מה שהציבור רואה כ«התפילה הבאה» וברשימות.</p>
        <Where wall="כן, בכל המסכים הרלוונטיים" phone="כן, כולל סימון «הבא»" />
        <div className="guide-links">
          <Link href={`${base}/prayers`}>פתיחת זמני תפילה</Link>
        </div>
        <ShotPair
          wallSrc="/guide/wall-main.png"
          mobileSrc="/guide/mobile-display.png"
          wallCaption="«התפילה הבאה» על הקיר נבנית מזמני התפילה ששמרתם."
          mobileCaption="גם בטלפון: שם התפילה והשעה, גדול וברור."
        />
        <h3>איך קובעים שעה</h3>
        <ul>
          <li><strong>שעה קבועה</strong> — למשל שחרית 07:00 כל יום.</li>
          <li><strong>לפי זריחה או שקיעה</strong> — «20 דקות אחרי השקיעה». הזמן עצמו מחושב לפי מיקום בית הכנסת.</li>
          <li><strong>לפי פרשת השבוע</strong> — מנחה וערבית משתנים לפי הטבלה השנתית.</li>
        </ul>
        <p>אפשר לעגל לחמש דקות, ולבחור באילו ימים התפילה חלה.</p>
        <h3>שבת</h3>
        <p>תפילות שבת נפרדות: מנחה ערב שבת וקבלת שבת, שחרית שבת, מנחה שבת, ערבית מוצאי שבת.</p>
        <p className="guide-note">אם מילאתם «סדר שבת», הוא מוצג במסך שבת במקום רשימת התפילות הרגילה.</p>
      </section>

      <section className="guide-section" id="bulletin">
        <h2>לוח מודעות</h2>
        <p>הודעת טקסט או תמונה לציבור. למשל שיעור, אזכרה, או בקשה.</p>
        <Where wall="מסך «לוח מודעות» אם הוא דלוק במראה" phone="כרטיס «לוח מודעות»" />
        <div className="guide-links">
          <Link href={`${base}/bulletin`}>פתיחת לוח המודעות</Link>
        </div>
        <ul>
          <li>בחרו טקסט או תמונה.</li>
          <li>אפשר להגביל תאריכים: מ־ ועד.</li>
          <li>סמנו «מוצג בלוח המודעות» רק כשרוצים שזה יופיע.</li>
          <li>לחצו «שמירת המודעות».</li>
        </ul>
        <p className="guide-note">המודעות משותפות לכל המניינים. אבל המסך עצמו חייב להיות דלוק ב«מראה המסך» של אותו מניין.</p>
      </section>

      <section className="guide-section" id="shabbat">
        <h2>סדר שבת</h2>
        <p>רשימה חופשית: מה קורה בשבת, לפי הסדר. למשל כניסת שבת, קבלת שבת, קריאת התורה, קידוש.</p>
        <Where wall="מסך שבת בשישי ובשבת" phone="כרטיס שבת בשישי ובשבת" />
        <div className="guide-links">
          <Link href={`${base}/shabbat`}>פתיחת סדר שבת</Link>
        </div>
        <ul>
          <li>כל שורה: שעה (לא חובה) + מה קורה.</li>
          <li>«מוצג בתצוגה» — אפשר להכין שורה בלי להראות אותה עדיין.</li>
          <li>אם אין סדר ידני, המסך יראה את זמני תפילות השבת.</li>
        </ul>
        <p>מנהג ההפטרה (במראה המסך) משפיע על שם ההפטרה במסך השבת שעל הקיר.</p>
      </section>

      <section className="guide-section" id="people">
        <h2>מתפללים</h2>
        <p>כרטיס לכל אדם: שם, אב ואם, כהן/לוי/ישראל, תאריך לידה, טלפון, מניין.</p>
        <Where gabbai="רשימה, ייבוא, ואישור נרשמים" none="לא מוצג על הקיר ולא במסך הזמנים בטלפון" />
        <div className="guide-links">
          <Link href={`${base}/congregants`}>פתיחת המתפללים</Link>
        </div>
        <ul>
          <li>אפשר להוסיף אחד־אחד, או לייבא מאקסל.</li>
          <li>«קישור למתפללים שימלאו בעצמם» — שולחים קישור, הם ממלאים, ואתם מאשרים.</li>
          <li>נרשם לבד נשאר «ממתין» עד שתאשרו. רק אז הוא ברשימה הרגילה.</li>
        </ul>
        <p>הטלפון חובה בהרשמה עצמית. אצל הגבאי אפשר בלי טלפון.</p>
        <p className="guide-note--mute guide-note">זה לא משפיע על הטלוויזיה. זה בשביל עליות, ובעתיד תזכורות.</p>
      </section>

      <section className="guide-section" id="aliyot">
        <h2>עליות</h2>
        <p>אחרי שבת או בחג — מסמנים מי עלה לתורה. לפי מניין ותאריך.</p>
        <Where gabbai="גיליון עליות" none="לא מוצג על הקיר ולא בטלפון של הציבור" />
        <div className="guide-links">
          <Link href={`${base}/aliyot`}>פתיחת העליות</Link>
        </div>
        <ul>
          <li>המערכת פותחת את השבת האחרונה. אפשר לעבור שבוע אחורה או קדימה.</li>
          <li>מחפשים את העולה לפי שם או טלפון.</li>
          <li>אם הוא לא ברשימה — «העולה לא ברשימה». נפתח חלון, מוסיפים מתפלל, וחוזרים ישר לאותה עלייה.</li>
          <li>אם אין כהן — בוחרים ישראל בכהן. נרשם שעלה במקומו.</li>
        </ul>
        <p>אפשר להוסיף עליות נוספות («הוספת עלייה»). לא לשכוח «שמירת העליות».</p>
      </section>

      <section className="guide-section" id="app">
        <h2>האפליקציה בטלפון</h2>
        <p>מתפלל פותח קישור, בוחר בית כנסת, ומסך הבית נשמר. בפעם הבאה הוא מגיע ישר לזמנים.</p>
        <ShotPair
          wallSrc="/guide/wall-main.png"
          mobileSrc="/guide/mobile-home.png"
          wallCaption="הקיר תמיד פתוח על הטלוויזיה — בלי התקנה."
          mobileCaption="בטלפון אפשר להתקין למסך הבית. הלוגו שלכם יהיה האייקון."
        />
        <h3>איך שולחים למתפלל</h3>
        <ol>
          <li>שלחו קישור לבית הכנסת, או את כתובת האתר עם שם בית הכנסת.</li>
          <li>בטלפון יופיע «התקינו את האפליקציה».</li>
          <li>באייפון: שיתוף → «הוסף למסך הבית».</li>
        </ol>
        <p>הרשמה עצמית למתפללים: מתוך מסך המתפללים מעתיקים את הקישור. בטלפון זה נפתח בטופס נוח.</p>
        <div className="guide-links">
          <a href={`/m/display?synagogueId=${encodeURIComponent(synagogueId)}`} target="_blank" rel="noreferrer">
            פתיחת תצוגת הטלפון
          </a>
          <Link className="guide-links--ghost" href={`${base}/congregants`}>
            קישור הרשמה למתפללים
          </Link>
        </div>
      </section>

      <section className="guide-section" id="faq">
        <h2>שאלות שחוזרות</h2>
        <div className="guide-grid">
          <div className="guide-card">
            <h3>שיניתי ולא רואה על הקיר</h3>
            <p>בדקו ששמרתם באותו מסך. הקיר מתעדכן לבד תוך זמן קצר — בלי לרענן את הטלוויזיה.</p>
          </div>
          <div className="guide-card">
            <h3>יש כמה מניינים</h3>
            <p>בחרו מניין לפני מראה / תפילות / שבת. על הקיר: <code>?minyan=1</code> למניין הראשון, 2 לשני.</p>
          </div>
          <div className="guide-card">
            <h3>מסך שבת לא מופיע</h3>
            <p>הוא מוצג רק בשישי ובשבת. באמצע השבוע הוא מוסתר בכוונה.</p>
          </div>
          <div className="guide-card">
            <h3>הלכה לא על הקיר</h3>
            <p>ב«מראה המסך» המסך «הלכה יומית» צריך להיות מסומן «מוצג».</p>
          </div>
          <div className="guide-card">
            <h3>זמני זריחה לא נכונים</h3>
            <p>המיקום והדלקת הנרות נקבעים אצל מנהל המערכת, לא אצל הגבאי.</p>
          </div>
          <div className="guide-card">
            <h3>עליות ומתפללים על המסך?</h3>
            <p>לא. זה רק אצלכם, לניהול. הציבור רואה זמנים, הלכה ומודעות.</p>
          </div>
        </div>
        <p className="guide-note guide-note--ok">אם משהו לא ברור — גללו לנושא למעלה, או פתחו את המסך עצמו מהכפתורים בכל פרק.</p>
      </section>
    </div>
  );
}
