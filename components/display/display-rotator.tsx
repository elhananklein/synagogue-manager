"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, Fragment, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Flame, MoonStar, ChevronLeft } from "lucide-react";
import { AnalogClock } from "@/components/display/analog-clock";
import { LiveClock } from "@/components/display/live-clock";
import { DisplayBulletinScreen } from "@/components/display/display-bulletin-screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DailyLearningLine } from "@/lib/hebcal";
import type { BulletinItem } from "@/lib/bulletin-board";
import type { DisplayPalette, DisplayStyle } from "@/lib/display-theme";
import { pickDisplayLiveFields, useDisplayLiveRefresh, useHalachicDayLiveRefresh } from "@/lib/display-live-refresh";

type ScreenKey =
  | "main"
  | "mainInfo"
  | "clock"
  | "omer"
  | "halacha"
  | "dailyLearning"
  | "prayerTimes"
  | "shabbat"
  | "bulletin"
  | "fullSchedule";

type RotatorScreen = {
  screenKey: ScreenKey;
  durationSeconds: number;
  enabled: boolean;
};

type PrayerSlot = {
  label: string;
  time: string;
  details: string;
};

type TimeSection = {
  title: string;
  items: Array<{ label: string; time: string; details?: string; kind: "zman" | "prayer" }>;
};

type Snapshot = {
  hebrewDate: string;
  gregorianDate: string;
  parasha: string;
  candleLighting: string | null;
  havdalah: string | null;
  dafYomi: string;
  zmanim: Array<{ label: string; time: string }>;
  halachicDayRollIso: string | null;
  rainText: string;
  blessingText: string;
  omerText: string | null;
  omerShortText?: string | null;
  amidahAdditionText: string | null;
  liturgicalTiles?: string[];
  haftarah?: { name: string | null; source: string } | null;
};

/** Auto-scroll for "זמני היום ותפילות" — set here so deploys always pick up pace changes (inline beats stale CSS). */
const TIMES_LIST_SCROLL_DURATION_SEC = 120;

/**
 * WoodSilver בלבד: כותרת יום|שעון|תאריך עברי במסגרת עגולה, תוספות+דף במסגרת עגולה, ללא רשימת זמני תפילה.
 * ל־false — חוזרים לכותרת הקלאסית (שם בית כנסת, נקודות, שעון) ולרשימת הזמנים גם ב־woodSilver.
 */
const ENABLE_WOOD_SILVER_REVOLUTION_LAYOUT = true;

function sortedSectionItemsWithMinutes(
  items: Array<{ label: string; time: string; details?: string; kind: "zman" | "prayer" }>
) {
  return items
    .map((row) => {
      const [h, m] = row.time.split(":").map(Number);
      return { ...row, totalMinutes: h * 60 + m };
    })
    .sort((a, b) => a.totalMinutes - b.totalMinutes);
}

/** חלון קבוע ללוח זמנים: הזמן הקודם + 9 קדימה (10 סה״כ, 5 בכל שורה). */
function fullScheduleWindow<T extends { totalMinutes: number; dayOffset: number }>(
  rows: T[],
  nowMinutes: number,
  windowSize = 10
): { visible: T[]; nextLocalIdx: number } {
  if (!rows.length) return { visible: [], nextLocalIdx: -1 };

  const nextIdx = rows.findIndex(
    (row) => row.dayOffset > 0 || row.totalMinutes >= nowMinutes
  );
  const effectiveNext = nextIdx === -1 ? rows.length : nextIdx;

  let start = Math.max(0, effectiveNext - 1);
  if (start + windowSize > rows.length) {
    start = Math.max(0, rows.length - windowSize);
  }
  const visible = rows.slice(start, start + windowSize);
  const nextLocalIdx = visible.findIndex(
    (row) => row.dayOffset > 0 || row.totalMinutes >= nowMinutes
  );
  return { visible, nextLocalIdx };
}

const PRAYER_TIMES_GROUP_ORDER = ["שחרית", "מנחה", "ערבית", "אחר"] as const;
type PrayerTimesGroupId = (typeof PRAYER_TIMES_GROUP_ORDER)[number];

const PRAYER_TIMES_GROUP_TITLES: Record<PrayerTimesGroupId, string> = {
  שחרית: "שחרית",
  מנחה: "מנחה",
  ערבית: "ערבית",
  אחר: "נוספות"
};

function prayerTimesGroupIdFromLabel(label: string): PrayerTimesGroupId {
  const t = label.trim();
  if (t.includes("שחרית")) return "שחרית";
  if (t.includes("מנחה")) return "מנחה";
  if (t.includes("ערבית")) return "ערבית";
  return "אחר";
}

/** כותרת קבוצה — בערב שבת מציגים את השם המלא במקום «מנחה» גנרי. */
type PrayerTimesGroupedRow = PrayerSlot & { totalMinutes: number; group: PrayerTimesGroupId };

function PrayerTimesGroupedRows({
  groups,
  nextHighlight
}: {
  groups: Array<{ group: PrayerTimesGroupId; title: string; rows: PrayerTimesGroupedRow[] }>;
  nextHighlight: { label: string; time: string } | null;
}) {
  return (
    <div className="display-prayer-times-groups">
      {groups.map(({ group, title, rows }) => (
        <div key={group} className="display-prayer-times-group">
          <div className="display-time-section-title">{title}</div>
          <div className="display-prayer-times-row-line" dir="rtl">
            {rows.map((item, idx) => {
              const isNext =
                nextHighlight !== null &&
                nextHighlight.label === item.label &&
                nextHighlight.time === item.time;
              return (
                <div
                  key={`${group}-${item.label}-${item.time}-${idx}`}
                  data-next-anchor={isNext ? "true" : undefined}
                  className={cn(
                    "display-time-row display-time-row--prayer display-prayer-times-cell",
                    isNext && "display-time-row--next"
                  )}
                >
                  <div className="display-time-main display-prayer-times-time-main">
                    <span className="display-time-value-wrap">
                      <span
                        className={cn(
                          "display-time-value display-prayer-times-time-value",
                          isNext && "display-time-value--next"
                        )}
                      >
                        {item.time}
                      </span>
                    </span>
                  </div>
                  {item.details ? (
                    <div className="display-time-details display-prayer-times-cell-detail">{item.details}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function prayerTimesGroupTitle(group: PrayerTimesGroupId, rows: Array<{ label: string }>): string {
  if (group === "מנחה" && rows.length > 0 && rows.every((r) => r.label.includes("ערב שבת"))) {
    return rows[0]!.label;
  }
  return PRAYER_TIMES_GROUP_TITLES[group];
}

function toHebrewNumber(num: number) {
  if (!Number.isInteger(num) || num <= 0) return "";
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const hundreds = ["", "ק", "ר", "ש", "ת"];

  let n = num;
  let out = "";

  while (n >= 400) {
    out += "ת";
    n -= 400;
  }
  if (n >= 100) {
    const h = Math.floor(n / 100);
    out += hundreds[h];
    n %= 100;
  }
  if (n === 15) return `${out}טו`;
  if (n === 16) return `${out}טז`;
  if (n >= 10) {
    const t = Math.floor(n / 10);
    out += tens[t];
    n %= 10;
  }
  if (n > 0) out += ones[n];
  return out;
}

/**
 * מקטין (ובאופציה גם מגדיל) את התוכן כדי שימלא את הגובה/רוחב הזמינים — ללא חיתוך.
 * קריטי לתצוגת קיר/טלוויזיה. כברירת מחדל רק מכווץ (scale<=1); עם grow גם מתרחב עד maxScale.
 */
function AutoFit({
  className,
  contentClassName,
  deps = [],
  grow = false,
  maxScale = 1.45,
  children
}: {
  className?: string;
  contentClassName?: string;
  deps?: unknown[];
  grow?: boolean;
  maxScale?: number;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const availH = outer.clientHeight;
      const availW = outer.clientWidth;
      const needH = inner.offsetHeight;
      const needW = inner.offsetWidth;
      if (!availH || !availW || !needH || !needW) return;
      const fitted = Math.min(availH / needH, availW / needW);
      const capped = grow ? Math.min(maxScale, fitted) : Math.min(1, fitted);
      const safe = Number.isFinite(capped) && capped > 0 ? capped : 1;
      setScale((prev) => (Math.abs(prev - safe) > 0.004 ? safe : prev));
    };

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(outer);
    ro.observe(inner);

    let cancelled = false;
    if (typeof document !== "undefined" && "fonts" in document) {
      (document as Document & { fonts: FontFaceSet }).fonts.ready
        .then(() => {
          if (!cancelled) measure();
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <div ref={outerRef} className={cn("display-autofit", className)}>
      <div
        ref={innerRef}
        className={cn("display-autofit-inner", contentClassName)}
        style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/** במסך שבת של «בולט מאוד»: הפונט נגזר מגובה הרשימה חלקי מספר השורות. */
function ShabbatPrayerList({
  rowCount,
  scaleToViewport,
  children
}: {
  rowCount: number;
  scaleToViewport: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!scaleToViewport) return;
    const el = ref.current;
    if (!el) return;

    const apply = () => {
      const n = Math.max(1, rowCount);
      const h = el.clientHeight;
      if (!h) return;
      const fontPx = Math.round(Math.min(110, Math.max(18, (h / n) * 0.46)));
      el.style.setProperty("--vb-shabbat-font", `${fontPx}px`);
    };

    apply();
    const frame = requestAnimationFrame(apply);
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [scaleToViewport, rowCount]);

  return (
    <CardContent
      ref={ref}
      className="display-shabbat-prayers"
      style={
        scaleToViewport
          ? ({ "--vb-shabbat-rows": String(Math.max(1, rowCount)) } as CSSProperties)
          : undefined
      }
    >
      {children}
    </CardContent>
  );
}

export function DisplayRotator({
  style,
  palette = "inkIvory",
  synagogueId: synagogueIdProp,
  synagogueName: synagogueNameProp,
  minyanName: minyanNameProp,
  screens: screensProp,
  dailyLearning: dailyLearningProp,
  snapshot: snapshotProp,
  halacha: halachaProp,
  prayerSchedule: prayerScheduleProp,
  timeSections: timeSectionsProp,
  footerText: footerTextProp,
  scheduleTimesListMode: scheduleTimesListModeProp = "all",
  shabbat: shabbatProp = null,
  shabbatMevarchimText: shabbatMevarchimTextProp = null,
  bulletinItems: bulletinItemsProp = []
}: {
  style: DisplayStyle;
  palette?: DisplayPalette;
  synagogueId: string | null;
  synagogueName: string;
  minyanName: string | null;
  screens: RotatorScreen[];
  dailyLearning: DailyLearningLine[];
  snapshot: Snapshot;
  halacha: {
    title: string;
    text: string;
    source?: string;
    chapterNumber?: number;
    sectionNumber?: number;
    segments?: string[];
  } | null;
  prayerSchedule: PrayerSlot[];
  timeSections: TimeSection[];
  footerText?: string | null;
  /** "prayers_only" — רשימת תפילות בלבד, נכנסת במלואה ולכן ללא גלילה אוטומטית */
  scheduleTimesListMode?: "all" | "prayers_only";
  /** שבת מברכין להצגה במסך הראשי (שישי/שבת) */
  shabbatMevarchimText?: string | null;
  /** נתוני מסך שבת: פרשה, כניסה/יציאה, וזמני תפילות שבת (כולל מנחה ערב שבת) */
  shabbat?: {
    parasha: string;
    candleLighting: string | null;
    havdalah: string | null;
    prayers: Array<{ label: string; time: string }>;
    mevarchimText?: string | null;
    agenda?: Array<{ itemTime: string | null; content: string }>;
    haftarah?: { name: string | null; source: string } | null;
  } | null;
  bulletinItems?: BulletinItem[];
}) {
  const [live, setLive] = useState(() => ({
    synagogueId: synagogueIdProp,
    synagogueName: synagogueNameProp,
    minyanName: minyanNameProp,
    screens: screensProp,
    dailyLearning: dailyLearningProp,
    snapshot: snapshotProp,
    halacha: halachaProp,
    prayerSchedule: prayerScheduleProp,
    timeSections: timeSectionsProp,
    footerText: footerTextProp ?? null,
    scheduleTimesListMode: scheduleTimesListModeProp,
    shabbat: shabbatProp,
    shabbatMevarchimText: shabbatMevarchimTextProp,
    bulletinItems: bulletinItemsProp
  }));
  const {
    synagogueId,
    synagogueName,
    minyanName,
    screens,
    dailyLearning,
    snapshot,
    halacha,
    prayerSchedule,
    timeSections,
    footerText,
    scheduleTimesListMode,
    shabbat,
    shabbatMevarchimText,
    bulletinItems
  } = live;

  const refreshLive = useDisplayLiveRefresh((view) => {
    setLive(pickDisplayLiveFields(view));
  });
  useHalachicDayLiveRefresh(snapshot.halachicDayRollIso, refreshLive);

  const enabledScreens = useMemo(() => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const jsDay = now.getDay();
    const isFriOrSat = jsDay === 5 || jsDay === 6;
    return screens.filter((s) => {
      if (!s.enabled) return false;
      if (s.screenKey === "shabbat" && !isFriOrSat) return false;
      if (s.screenKey === "omer" && !snapshot.omerText) return false;
      return true;
    });
  }, [screens, snapshot.omerText, style]);
  const [index, setIndex] = useState(0);
  const [halachaSeifIndex, setHalachaSeifIndex] = useState(0);
  const timesScrollRef = useRef<HTMLDivElement | null>(null);
  const [timesStartOffset, setTimesStartOffset] = useState<number | null>(null);
  const screenCount = enabledScreens.length;
  const halachaSegments = useMemo(() => {
    const fromSegments = halacha?.segments?.map((item) => item.trim()).filter(Boolean) ?? [];
    if (fromSegments.length) return fromSegments;
    const single = halacha?.text?.trim();
    return single ? [single] : [];
  }, [halacha]);

  const goNextScreen = () => {
    if (screenCount < 2) return;
    setIndex((prev) => (prev + 1) % screenCount);
  };
  const goPrevScreen = () => {
    if (screenCount < 2) return;
    setIndex((prev) => (prev - 1 + screenCount) % screenCount);
  };

  useEffect(() => {
    if (!enabledScreens.length) return;
    const current = enabledScreens[index % enabledScreens.length];
    const baseSeconds = Math.max(5, current.durationSeconds);
    const isBulletin = current.screenKey === "bulletin";
    const bulletinCount = bulletinItems.length;
    const isHalacha = current.screenKey === "halacha";
    const durationMs =
      isBulletin && bulletinCount > 0
        ? baseSeconds * 1000 * bulletinCount
        : isHalacha && halachaSegments.length > 1
          ? baseSeconds * 1000 * halachaSegments.length
          : baseSeconds * 1000;
    const timer = setTimeout(() => setIndex((prev) => (prev + 1) % enabledScreens.length), durationMs);
    return () => clearTimeout(timer);
  }, [enabledScreens, index, bulletinItems.length, halachaSegments.length]);

  useEffect(() => {
    setHalachaSeifIndex(0);
  }, [halachaSegments]);

  useEffect(() => {
    const current = enabledScreens[index % Math.max(enabledScreens.length, 1)];
    if (current?.screenKey !== "halacha" || halachaSegments.length < 2) return;
    const eachMs = Math.max(12, current.durationSeconds) * 1000;
    const id = window.setInterval(() => {
      setHalachaSeifIndex((prev) => (prev + 1) % halachaSegments.length);
    }, eachMs);
    return () => window.clearInterval(id);
  }, [enabledScreens, index, halachaSegments.length]);

  useEffect(() => {
    if (screenCount < 2) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "PageDown" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setIndex((prev) => (prev + 1) % screenCount);
      } else if (e.key === "ArrowRight" || e.key === "PageUp" || e.key === "Backspace") {
        e.preventDefault();
        setIndex((prev) => (prev - 1 + screenCount) % screenCount);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screenCount]);

  useEffect(() => {
    // כניסה אוטומטית למסך מלא. דפדפנים חוסמים מסך מלא ללא מחווה — מנסים בטעינה
    // (קיוסק/הרשאה), אחרי reload, ובכל לחיצה אם עדיין לא במסך מלא. לחיצה שנייה מוציאה.
    type FsElement = HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };
    type FsDocument = Document & {
      webkitFullscreenElement?: Element | null;
      msFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
      msExitFullscreen?: () => Promise<void> | void;
    };
    const DISPLAY_FS_KEY = "display-want-fullscreen";
    const settle = (result: Promise<void> | void) => {
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => {});
      }
    };
    const isFullscreen = () => {
      if (typeof document === "undefined") return false;
      const doc = document as FsDocument;
      return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
    };
    let userExited = false;
    const requestFullscreen = () => {
      if (typeof document === "undefined" || userExited) return;
      if (isFullscreen()) return;
      const el = document.documentElement as FsElement;
      const fn = el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.msRequestFullscreen;
      if (!fn) return;
      try {
        settle(fn.call(el));
      } catch {
        /* הדפדפן דחה — נחכה למחווה הבאה */
      }
    };
    const exitFullscreen = () => {
      if (typeof document === "undefined" || !isFullscreen()) return;
      const doc = document as FsDocument;
      const fn = doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.msExitFullscreen;
      if (!fn) return;
      try {
        settle(fn.call(doc));
      } catch {
        /* ignore */
      }
    };
    const shouldIgnoreToggle = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest("a, button, input, textarea, select, [role='button']"));
    };

    try {
      sessionStorage.setItem(DISPLAY_FS_KEY, "1");
    } catch {
      /* ignore */
    }

    requestFullscreen();
    const retryIds = [400, 1200, 3000].map((ms) => window.setTimeout(requestFullscreen, ms));

    const onClick = (event: MouseEvent) => {
      if (shouldIgnoreToggle(event.target)) return;
      if (isFullscreen()) {
        userExited = true;
        exitFullscreen();
      } else {
        userExited = false;
        requestFullscreen();
      }
    };
    const onKeyDown = () => {
      if (!isFullscreen()) requestFullscreen();
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      retryIds.forEach((id) => clearTimeout(id));
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const currentScreen = enabledScreens.length ? enabledScreens[index % enabledScreens.length].screenKey : null;
  const isWoodSilverRevolution = style === "woodSilver" && ENABLE_WOOD_SILVER_REVOLUTION_LAYOUT;
  const isVeryBold = style === "veryBold";
  /** כמו woodSilver revolution: יום | שעון | תאריך עברי בכותרת — גם ב־Classic */
  const useCenterClockBand = !isVeryBold && (isWoodSilverRevolution || style === "classic" || style === "royalBlue");
  const nowJerusalem = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const nowMinutes = nowJerusalem.getHours() * 60 + nowJerusalem.getMinutes();
  const jerusalemJsDay = nowJerusalem.getDay();
  const jerusalemWeekdayLong =
    jerusalemJsDay === 6
      ? "שבת"
      : new Intl.DateTimeFormat("he-IL", {
          weekday: "long",
          timeZone: "Asia/Jerusalem"
        }).format(nowJerusalem);
  const headerCandleLighting = shabbat?.candleLighting ?? snapshot.candleLighting;
  const headerHavdalah = shabbat?.havdalah ?? snapshot.havdalah;
  const showHeaderShabbatZmanim =
    (jerusalemJsDay === 5 || jerusalemJsDay === 6) &&
    Boolean(headerCandleLighting || headerHavdalah);
  const todaySectionItems = timeSections[0]?.items ?? [
    ...snapshot.zmanim.map((row) => ({ label: row.label, time: row.time, kind: "zman" as const })),
    ...prayerSchedule.map((row) => ({ label: row.label, time: row.time, details: row.details, kind: "prayer" as const }))
  ];
  const todayMergedTimes = sortedSectionItemsWithMinutes(todaySectionItems);
  const nextTodayIdx = todayMergedTimes.findIndex((item) => item.totalMinutes >= nowMinutes);
  const pastAllTodaySlots = nextTodayIdx === -1;

  let nextSectionIndex = 0;
  let nextSlotIndexInSection = nextTodayIdx === -1 ? 0 : nextTodayIdx;
  if (pastAllTodaySlots && timeSections[1]?.items?.length) {
    const tomorrowMerged = sortedSectionItemsWithMinutes(timeSections[1].items);
    const alotTomorrowIdx = tomorrowMerged.findIndex((item) => item.label.trim() === "עלות השחר");
    if (alotTomorrowIdx >= 0) {
      nextSectionIndex = 1;
      nextSlotIndexInSection = alotTomorrowIdx;
    }
  }

  const todayPrayerTimes = todayMergedTimes.filter((item) => item.kind === "prayer");
  const tomorrowPrayerTimes = timeSections[1]?.items?.length
    ? sortedSectionItemsWithMinutes(timeSections[1].items).filter((item) => item.kind === "prayer")
    : [];
  const nextPrayer = (() => {
    if (todayPrayerTimes.length) {
      const idx = todayPrayerTimes.findIndex((item) => item.totalMinutes >= nowMinutes);
      if (idx !== -1) return todayPrayerTimes[idx];
    }
    if (!tomorrowPrayerTimes.length) return null;
    return tomorrowPrayerTimes[0];
  })();
  /** להדגשה במסך «זמני תפילות» בלבד — רק תפילה עתידית באותו יום לפי שעון ירושלים */
  const nextTodayPrayerHighlight =
    todayPrayerTimes.length === 0
      ? null
      : (() => {
          const idx = todayPrayerTimes.findIndex((item) => item.totalMinutes >= nowMinutes);
          if (idx === -1) return null;
          const p = todayPrayerTimes[idx];
          return { label: p.label, time: p.time };
        })();
  const prayerTimesScreenGroups = useMemo(() => {
    type Row = PrayerSlot & { totalMinutes: number; group: PrayerTimesGroupId };
    const rows: Row[] = prayerSchedule
      .map((row) => {
        const [h, m] = row.time.split(":").map(Number);
        const hh = Number.isFinite(h) ? h : 0;
        const mm = Number.isFinite(m) ? m : 0;
        return {
          ...row,
          totalMinutes: hh * 60 + mm,
          group: prayerTimesGroupIdFromLabel(row.label)
        };
      });
    rows.sort((a, b) => a.totalMinutes - b.totalMinutes);
    const byGroup = new Map<PrayerTimesGroupId, Row[]>();
    for (const r of rows) {
      const list = byGroup.get(r.group) ?? [];
      list.push(r);
      byGroup.set(r.group, list);
    }
    return PRAYER_TIMES_GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => {
      const groupRows = byGroup.get(group)!;
      return {
        group,
        title: prayerTimesGroupTitle(group, groupRows),
        rows: groupRows
      };
    });
  }, [prayerSchedule]);
  const prayerTimesNextBanner =
    nextTodayPrayerHighlight &&
    (() => {
      const h = nextTodayPrayerHighlight;
      return `התפילה הבאה: ${h.label} - ${h.time}`;
    })();
  const amidahAddition = snapshot.amidahAdditionText;
  const shouldAutoScroll =
    currentScreen === "main" &&
    timeSections.length > 0 &&
    !isWoodSilverRevolution &&
    !isVeryBold &&
    scheduleTimesListMode !== "prayers_only";
  const halachaClosingLinePattern = /["״']?\s*כל השונה הלכות בכל יום\s+מובטח לו שהוא בן העולם הבא["״']?\s*$/;
  const currentHalachaBody = halachaSegments[halachaSeifIndex] ?? halacha?.text ?? "";
  const halachaText = halacha
    ? (() => {
        const raw = currentHalachaBody.trim();
        const closingLineMatch = raw.match(halachaClosingLinePattern)?.[0]?.trim() ?? null;
        const withoutClosing = closingLineMatch ? raw.replace(halachaClosingLinePattern, "").trim() : raw;
        const withSentenceBreaks = withoutClosing.replace(/\.\s+/g, ".\n");
        const normalized = withSentenceBreaks.replace(/\n{3,}/g, "\n\n").trim();
        const idx = normalized.indexOf(":");
        if (idx === -1) return { intro: null, body: normalized, closingLine: closingLineMatch };
        const intro = normalized.slice(0, idx + 1).trim();
        const body = normalized.slice(idx + 1).trim();
        if (!intro || !body) return { intro: null, body: normalized, closingLine: closingLineMatch };
        return { intro, body, closingLine: closingLineMatch };
      })()
    : null;
  const chapterHebrew = halacha?.chapterNumber ? toHebrewNumber(halacha.chapterNumber) : "";
  const sectionHebrew = halacha?.sectionNumber ? toHebrewNumber(halacha.sectionNumber) : "";
  const halachaHeaderLabel =
    halacha &&
    (chapterHebrew && sectionHebrew
      ? `פרק ${chapterHebrew} הלכה ${sectionHebrew}`
      : halacha.title);
  const halachaSeifCounter =
    halachaSegments.length > 1
      ? `סעיף ${toHebrewNumber(halachaSeifIndex + 1)} מתוך ${toHebrewNumber(halachaSegments.length)}`
      : null;
  const adminHref = synagogueId ? `/admin/gabbai/${synagogueId}` : null;
  const isAutoScrollReady = shouldAutoScroll && timesStartOffset !== null;
  const timesTrackStyle = (() => {
    if (!shouldAutoScroll) return undefined;
    const offsetPx = `${timesStartOffset ?? 0}px`;
    const base = { "--times-start-offset": offsetPx } as CSSProperties;
    if (!isAutoScrollReady) return base;
    return {
      ...base,
      animation: `display-times-scroll ${TIMES_LIST_SCROLL_DURATION_SEC}s linear infinite`,
      willChange: "transform"
    } as CSSProperties;
  })();

  useLayoutEffect(() => {
    if (!shouldAutoScroll) {
      setTimesStartOffset(null);
      return;
    }
    const listEl = timesScrollRef.current;
    if (!listEl) {
      setTimesStartOffset(0);
      return;
    }

    const nextRow = listEl.querySelector('[data-next-anchor="true"]') as HTMLDivElement | null;
    if (!nextRow) {
      setTimesStartOffset(0);
      return;
    }

    const listRect = listEl.getBoundingClientRect();
    const rowRect = nextRow.getBoundingClientRect();
    const rowCenter = rowRect.top - listRect.top + rowRect.height / 2;
    const containerCenter = listEl.clientHeight / 2;
    setTimesStartOffset(Math.max(0, rowCenter - containerCenter));
  }, [shouldAutoScroll, nextSectionIndex, nextSlotIndexInSection, timeSections, index]);

  return (
    <main
      className={`display display--${style}${isVeryBold ? ` display-palette--${palette}` : ""}`}
      data-display-palette={isVeryBold ? palette : undefined}
    >
      {!enabledScreens.length ? (
        <div className="display-empty">אין מסכים פעילים לתצוגה</div>
      ) : (
      <div className="display-frame">
        {screenCount > 1 ? (
          <>
            <button
              type="button"
              className="display-nav-edge display-nav-edge--prev"
              aria-label="מסך קודם"
              title="מסך קודם (חץ ימינה)"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goPrevScreen();
              }}
            />
            <button
              type="button"
              className="display-nav-edge display-nav-edge--next"
              aria-label="מסך הבא"
              title="מסך הבא (חץ שמאלה / רווח)"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goNextScreen();
              }}
            />
          </>
        ) : null}
        <header
          className={cn(
            "display-header",
            useCenterClockBand && "display-header--center-clock-band",
            isVeryBold && "display-header--very-bold"
          )}
        >
          {isVeryBold ? (
            <>
              <div
                className="display-vb-bar"
                role="status"
                aria-label={`מסך ${index + 1} מתוך ${enabledScreens.length}: ${jerusalemWeekdayLong}, ${snapshot.hebrewDate}`}
              >
                <div
                  className="display-vb-date"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    void refreshLive();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void refreshLive();
                    }
                  }}
                  aria-label="רענון נתוני התצוגה"
                  title="רענון"
                >
                  {snapshot.hebrewDate}
                </div>
                <h1 className="display-vb-name">
                  {minyanName ? `${synagogueName} · ${minyanName}` : synagogueName}
                </h1>
                <div className="display-vb-day">{jerusalemWeekdayLong}</div>
              </div>
              {adminHref ? (
                <Link
                  href={adminHref}
                  className="display-vb-clock display-clock-admin-hit"
                  aria-label="מעבר לממשק ניהול בית הכנסת"
                  prefetch={false}
                >
                  <LiveClock showSeconds={false} />
                </Link>
              ) : (
                <div className="display-vb-clock">
                  <LiveClock showSeconds={false} />
                </div>
              )}
            </>
          ) : useCenterClockBand ? (
            <div
              className={cn(
                "display-ws-header-band",
                showHeaderShabbatZmanim && "display-ws-header-band--shabbat"
              )}
              role="status"
              aria-label={
                showHeaderShabbatZmanim
                  ? `מסך ${index + 1} מתוך ${enabledScreens.length}: ${jerusalemWeekdayLong}, ${snapshot.hebrewDate}. כניסת שבת ${headerCandleLighting ?? ""}, צאת השבת ${headerHavdalah ?? ""}`
                  : `מסך ${index + 1} מתוך ${enabledScreens.length}: ${jerusalemWeekdayLong}, ${snapshot.hebrewDate}`
              }
            >
              <div className="display-ws-side display-ws-side--day">
                <div className="display-ws-lozenge display-ws-lozenge--day">{jerusalemWeekdayLong}</div>
                {showHeaderShabbatZmanim && headerCandleLighting ? (
                  <div className="display-ws-shabbat-zman display-ws-shabbat-zman--in">
                    <Flame className="display-ws-shabbat-zman-icon" aria-hidden strokeWidth={2.25} />
                    <span className="display-ws-shabbat-zman-label">כניסת שבת</span>
                    <span className="display-ws-shabbat-zman-time">{headerCandleLighting}</span>
                  </div>
                ) : null}
              </div>
              {adminHref ? (
                <Link
                  href={adminHref}
                  className="display-ws-clock-circle display-clock-admin-hit"
                  aria-label="מעבר לממשק ניהול בית הכנסת"
                  prefetch={false}
                >
                  <LiveClock showSeconds={style !== "classic"} />
                </Link>
              ) : (
                <div className="display-ws-clock-circle">
                  <LiveClock showSeconds={style !== "classic"} />
                </div>
              )}
              <div className="display-ws-side display-ws-side--date">
                <div
                  className="display-ws-lozenge display-ws-lozenge--hebrew-date display-ws-lozenge--refresh"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    void refreshLive();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void refreshLive();
                    }
                  }}
                  aria-label="רענון נתוני התצוגה"
                  title="רענון"
                >
                  {snapshot.hebrewDate}
                </div>
                {showHeaderShabbatZmanim && headerHavdalah ? (
                  <div className="display-ws-shabbat-zman display-ws-shabbat-zman--out">
                    <MoonStar className="display-ws-shabbat-zman-icon" aria-hidden strokeWidth={2.25} />
                    <span className="display-ws-shabbat-zman-label">צאת השבת</span>
                    <span className="display-ws-shabbat-zman-time">{headerHavdalah}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div
                className="display-screen-dots"
                role="status"
                aria-label={`מסך ${index + 1} מתוך ${enabledScreens.length}`}
              >
                {enabledScreens.map((_, i) => (
                  <span
                    key={i}
                    className={i === index ? "display-screen-dot display-screen-dot--active" : "display-screen-dot"}
                    aria-hidden
                  />
                ))}
              </div>
              <h1 className="display-title">
                {minyanName ? `${synagogueName} - ${minyanName}` : synagogueName}
              </h1>
              {adminHref ? (
                <Link
                  href={adminHref}
                  className="display-header-clock display-clock-admin-hit"
                  aria-label="מעבר לממשק ניהול בית הכנסת"
                  prefetch={false}
                >
                  <LiveClock showSeconds />
                </Link>
              ) : (
                <div className="display-header-clock">
                  <LiveClock showSeconds />
                </div>
              )}
            </>
          )}
        </header>

        <div
          key={`${index}-${currentScreen}`}
          className="display-screen-stage"
        >
        {currentScreen === "clock" ? (
          <section className="display-datetime-screen">
            <div className="display-datetime-pair">
              <AnalogClock />
              <div className="display-datetime-digital-col">
                <div dir="ltr">
                  <LiveClock className="display-datetime-digital" splitSeconds />
                </div>
                {nextPrayer ? (
                  <p className="display-datetime-next-prayer">
                    <span className="display-datetime-next-prayer-label">התפילה הבאה:</span>
                    <span className="display-datetime-next-prayer-detail">
                      {nextPrayer.label} ב {nextPrayer.time}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {currentScreen === "omer" ? (
          <section
            className={cn(
              "display-clock-screen display-card",
              isWoodSilverRevolution && "display-clock-screen--ws-revolution",
              style === "classic" && useCenterClockBand && "display-clock-screen--classic-band"
            )}
          >
            <p className="display-omer-line">{snapshot.omerText}</p>
          </section>
        ) : null}

        {currentScreen === "halacha" ? (
          <Card className="display-card">
            {halacha && halachaText ? (
              <>
                <CardHeader>
                  <CardTitle className="display-halacha-title display-halacha-title-row">
                    <span>{halachaHeaderLabel}</span>
                    {halachaSeifCounter ? (
                      <span className="display-halacha-source">{halachaSeifCounter}</span>
                    ) : null}
                    {halacha.source ? <span className="display-halacha-source">({halacha.source})</span> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="display-halacha-text">
                    {halachaText.intro ? <span className="display-halacha-intro">{halachaText.intro}</span> : null}
                    {halachaText.intro ? <br /> : null}
                    {halachaText.body}
                    {halachaText.closingLine ? (
                      <span className="display-halacha-signature">{halachaText.closingLine}</span>
                    ) : null}
                  </p>
                </CardContent>
              </>
            ) : (
              <CardContent className="display-daily-learning-body">
                <p className="display-daily-learning-empty">אין הלכה יומית להצגה.</p>
              </CardContent>
            )}
          </Card>
        ) : null}

        {currentScreen === "dailyLearning" ? (
          <Card className="display-card display-daily-learning-card">
            <CardHeader className="display-daily-learning-header">
              <CardTitle className="display-daily-learning-title">לימוד יומי</CardTitle>
              <p className="display-daily-learning-note">לפי לוח הלימוד היומי (מקור הנתונים כמו דף יומי במסך הראשי)</p>
            </CardHeader>
            <CardContent className="display-daily-learning-body">
              {dailyLearning.length ? (
                <ul className="display-daily-learning-list">
                  {dailyLearning.map((row) => (
                    <li key={row.id} className="display-daily-learning-row">
                      <span className="display-daily-learning-name">{row.title}</span>
                      <span className="display-daily-learning-detail" dir="rtl">
                        {row.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="display-daily-learning-empty">לא ניתן לטעון את נתוני הלימוד כרגע.</p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {currentScreen === "prayerTimes" ? (
          <Card className="display-card display-prayer-times-card">
            <CardHeader className="display-prayer-times-header">
              <CardTitle className="display-times-title">זמני תפילות</CardTitle>
              {prayerTimesNextBanner ? (
                <p className="display-next-prayer">{prayerTimesNextBanner}</p>
              ) : null}
            </CardHeader>
            <CardContent className="display-prayer-times-body">
              {prayerTimesScreenGroups.length === 0 ? (
                <p className="display-daily-learning-empty">אין תפילות להיום.</p>
              ) : (
                <AutoFit
                  className="display-prayer-times-fit"
                  contentClassName="display-prayer-times-fit-inner"
                  deps={[currentScreen, prayerTimesScreenGroups, prayerTimesNextBanner]}
                >
                  <PrayerTimesGroupedRows
                    groups={prayerTimesScreenGroups}
                    nextHighlight={nextTodayPrayerHighlight}
                  />
                </AutoFit>
              )}
            </CardContent>
          </Card>
        ) : null}

        {currentScreen === "fullSchedule" ? (
          <Card className="display-card display-full-schedule-card">
            <CardHeader className="display-full-schedule-header">
              <CardTitle className="display-times-title">לוח זמנים</CardTitle>
              {nextPrayer ? (
                <p className="display-next-prayer">
                  התפילה הבאה: {nextPrayer.label} - {nextPrayer.time}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="display-full-schedule-body">
              {(() => {
                const timeline = [
                  ...sortedSectionItemsWithMinutes(timeSections[0]?.items ?? []).map((row) => ({
                    ...row,
                    dayOffset: 0 as const,
                    dayTag: null as string | null
                  })),
                  ...sortedSectionItemsWithMinutes(timeSections[1]?.items ?? []).map((row) => ({
                    ...row,
                    dayOffset: 1 as const,
                    dayTag: "מחר" as string | null
                  }))
                ];
                if (!timeline.length) {
                  return <p className="display-daily-learning-empty">אין זמנים להצגה.</p>;
                }
                const { visible, nextLocalIdx } = fullScheduleWindow(timeline, nowMinutes, 10);
                return (
                  <AutoFit
                    className="display-full-schedule-fit"
                    contentClassName="display-full-schedule-fit-inner"
                    grow
                    maxScale={2.4}
                    deps={[currentScreen, visible, nextLocalIdx]}
                  >
                    <div className="display-full-schedule-flow" dir="rtl">
                      {visible.map((item, idx) => {
                        const isNext = idx === nextLocalIdx;
                        const isPast = nextLocalIdx === -1 ? true : idx < nextLocalIdx;
                        const isPrayer = item.kind === "prayer";
                        const label = isPrayer ? `תפילת ${item.label}` : item.label;
                        return (
                          <article
                            key={`${item.dayOffset}-${item.kind}-${item.label}-${item.time}-${idx}`}
                            className={cn(
                              "display-full-schedule-tile",
                              isPrayer && "display-full-schedule-tile--prayer",
                              isNext && "display-full-schedule-tile--next",
                              isPast && !isNext && "display-full-schedule-tile--past"
                            )}
                          >
                            {idx > 0 ? (
                              <span
                                className={cn(
                                  "display-full-schedule-arrow",
                                  idx === nextLocalIdx && "display-full-schedule-arrow--to-next"
                                )}
                                aria-hidden
                              >
                                <ChevronLeft strokeWidth={2.75} />
                              </span>
                            ) : null}
                            {isNext ? (
                              <span className="display-full-schedule-next-badge">הבא</span>
                            ) : null}
                            {item.dayTag ? (
                              <span className="display-full-schedule-day-tag">{item.dayTag}</span>
                            ) : null}
                            <p className="display-full-schedule-tile-label">{label}</p>
                            <p className="display-full-schedule-tile-time">{item.time}</p>
                            {"details" in item && item.details ? (
                              <p className="display-full-schedule-tile-details">{item.details}</p>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </AutoFit>
                );
              })()}
            </CardContent>
          </Card>
        ) : null}

        {currentScreen === "main" ? (
          <section className={cn("display-main-grid", isWoodSilverRevolution && "display-main-grid--ws-revolution")}>
            <div className="display-main-primary">
              <div className="display-main-primary-stack">
                <PrimaryInfoStack
                  snapshot={snapshot}
                  isWoodSilverRevolution={isWoodSilverRevolution}
                  hideChromeDates={isWoodSilverRevolution || isVeryBold}
                  amidahAddition={amidahAddition}
                  mevarchimText={shabbatMevarchimText}
                />
              </div>
            </div>

            {!isWoodSilverRevolution ? (
            <Card
              className={cn(
                "display-card display-main-times-card",
                isVeryBold && scheduleTimesListMode === "prayers_only" && "display-main-times-card--prayers"
              )}
            >
              {!(isVeryBold && scheduleTimesListMode === "prayers_only") ? (
                <CardHeader>
                  <CardTitle className="display-times-title">
                    {scheduleTimesListMode === "prayers_only" ? "זמני תפילות" : "זמני היום ותפילות"}
                  </CardTitle>
                  {nextPrayer ? (
                    <p className="display-next-prayer">
                      התפילה הבאה: {nextPrayer.label} - {nextPrayer.time}
                    </p>
                  ) : null}
                </CardHeader>
              ) : null}
              {isVeryBold && scheduleTimesListMode === "prayers_only" ? (
                <CardContent className="display-prayer-times-body">
                  {prayerTimesScreenGroups.length === 0 ? (
                    <p className="display-daily-learning-empty">אין תפילות להיום.</p>
                  ) : (
                    <AutoFit
                      className="display-prayer-times-fit"
                      contentClassName="display-prayer-times-fit-inner"
                      deps={[currentScreen, prayerTimesScreenGroups, nextTodayPrayerHighlight]}
                    >
                      <PrayerTimesGroupedRows
                        groups={prayerTimesScreenGroups}
                        nextHighlight={nextTodayPrayerHighlight}
                      />
                    </AutoFit>
                  )}
                </CardContent>
              ) : (
              <CardContent className="display-times-content">
                <div
                  ref={timesScrollRef}
                  className={cn("display-times-list", !shouldAutoScroll && "display-times-list--static")}
                >
                  <div
                    className={isAutoScrollReady ? "display-times-track display-times-track--auto" : "display-times-track"}
                    style={timesTrackStyle}
                  >
                  {timeSections.map((section, sectionIndex) => (
                    <div key={`section-${sectionIndex}`} className="display-time-section">
                      <div className="display-time-section-title">{section.title}</div>
                      {section.items
                        .map((row) => {
                          const [h, m] = row.time.split(":").map(Number);
                          return { ...row, totalMinutes: h * 60 + m };
                        })
                        .sort((a, b) => a.totalMinutes - b.totalMinutes)
                        .map((item, idx) => {
                          const isNext = sectionIndex === nextSectionIndex && idx === nextSlotIndexInSection;
                          const isPrayer = item.kind === "prayer";
                          return (
                            <div
                              key={`${sectionIndex}-${item.kind}-${item.label}-${item.time}-${idx}`}
                              data-next-anchor={isNext ? "true" : undefined}
                              className={`display-time-row ${isPrayer ? "display-time-row--prayer" : ""} ${isNext ? "display-time-row--next" : ""}`}
                            >
                              <div className="display-time-main">
                                <span className={isPrayer ? "display-time-label display-time-label--prayer" : "display-time-label"}>
                                  {isPrayer ? `תפילת ${item.label}` : item.label}
                                </span>
                                <span className="display-time-value-wrap">
                                  <span className={isNext ? "display-time-value display-time-value--next" : "display-time-value"}>{item.time}</span>
                                  {sectionIndex === 1 ? <span className="display-time-tomorrow-note">מחר</span> : null}
                                </span>
                              </div>
                              {"details" in item && item.details ? <div className="display-time-details">{item.details}</div> : null}
                            </div>
                          );
                        })}
                      {sectionIndex === 0 ? <div className="display-times-section-gap" /> : null}
                    </div>
                  ))}
                  {shouldAutoScroll ? <div className="display-times-loop-gap" /> : null}
                  {shouldAutoScroll ? timeSections.map((section, sectionIndex) => (
                    <div key={`dup-section-${sectionIndex}`} className="display-time-section">
                      <div className="display-time-section-title">{section.title}</div>
                      {section.items
                        .map((row) => {
                          const [h, m] = row.time.split(":").map(Number);
                          return { ...row, totalMinutes: h * 60 + m };
                        })
                        .sort((a, b) => a.totalMinutes - b.totalMinutes)
                        .map((item, idx) => {
                          const isNext = sectionIndex === nextSectionIndex && idx === nextSlotIndexInSection;
                          const isPrayer = item.kind === "prayer";
                          return (
                            <div
                              key={`dup-${sectionIndex}-${item.kind}-${item.label}-${item.time}-${idx}`}
                              className={`display-time-row ${isPrayer ? "display-time-row--prayer" : ""} ${isNext ? "display-time-row--next" : ""}`}
                            >
                              <div className="display-time-main">
                                <span className={isPrayer ? "display-time-label display-time-label--prayer" : "display-time-label"}>
                                  {isPrayer ? `תפילת ${item.label}` : item.label}
                                </span>
                                <span className="display-time-value-wrap">
                                  <span className={isNext ? "display-time-value display-time-value--next" : "display-time-value"}>{item.time}</span>
                                  {sectionIndex === 1 ? <span className="display-time-tomorrow-note">מחר</span> : null}
                                </span>
                              </div>
                              {"details" in item && item.details ? <div className="display-time-details">{item.details}</div> : null}
                            </div>
                          );
                        })}
                      {sectionIndex === 0 ? <div className="display-times-section-gap" /> : null}
                    </div>
                  )) : null}
                  </div>
                </div>
              </CardContent>
              )}
            </Card>
            ) : null}
          </section>
        ) : null}

        {currentScreen === "mainInfo" ? (
          <Card className="display-card display-info-card">
            <div className="display-info-stack">
              {nextPrayer ? (
                <p className="display-info-next-prayer">
                  התפילה הבאה: {nextPrayer.label} - {nextPrayer.time}
                </p>
              ) : null}
              <PrimaryInfoStack
                snapshot={snapshot}
                isWoodSilverRevolution={isWoodSilverRevolution}
                hideChromeDates={isWoodSilverRevolution || isVeryBold}
                amidahAddition={amidahAddition}
                mevarchimText={shabbatMevarchimText}
              />
            </div>
          </Card>
        ) : null}

        {currentScreen === "bulletin" ? (
          <DisplayBulletinScreen
            items={bulletinItems}
            secondsPerItem={enabledScreens[index % enabledScreens.length]?.durationSeconds ?? 20}
          />
        ) : null}

        {currentScreen === "shabbat" ? (
          <section className="display-shabbat-screen">
            {(() => {
              const shabbatInner = (
                <div className="display-shabbat-inner">
                  <div className="display-shabbat-hero">
                    <div className="display-shabbat-heading">
                      <p className="display-shabbat-title">{isVeryBold ? "שבת" : "שבת קודש"}</p>
                      <p className="display-shabbat-parasha">{shabbat?.parasha ?? snapshot.parasha}</p>
                      {(() => {
                        const haftarah = shabbat?.haftarah ?? snapshot.haftarah;
                        if (!haftarah?.name && !haftarah?.source) return null;
                        return (
                          <p className="display-shabbat-haftarah">
                            <span className="display-shabbat-haftarah-name">
                              {haftarah.name ? `הפטרת ${haftarah.name}` : "הפטרה"}
                            </span>
                            {haftarah.source ? (
                              <span className="display-shabbat-haftarah-source">{haftarah.source}</span>
                            ) : null}
                          </p>
                        );
                      })()}
                      {shabbat?.mevarchimText ? (
                        <p className="display-shabbat-mevarchim">{shabbat.mevarchimText}</p>
                      ) : null}
                    </div>

                    <div className="display-shabbat-zmanim">
                      <Card className="display-card display-shabbat-zman-card">
                        <CardContent className="display-shabbat-zman-content">
                          <span className="display-shabbat-zman-label">כניסת שבת</span>
                          <span className="display-shabbat-zman-time display-accent">
                            {shabbat?.candleLighting ?? snapshot.candleLighting ?? "—"}
                          </span>
                        </CardContent>
                      </Card>
                      <Card className="display-card display-shabbat-zman-card">
                        <CardContent className="display-shabbat-zman-content">
                          <span className="display-shabbat-zman-label">צאת שבת</span>
                          <span className="display-shabbat-zman-time display-accent">
                            {shabbat?.havdalah ?? snapshot.havdalah ?? "—"}
                          </span>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {shabbat?.agenda?.length ? (
                    <Card className="display-card display-shabbat-prayers-card">
                      <ShabbatPrayerList rowCount={shabbat.agenda.length} scaleToViewport={isVeryBold}>
                        {shabbat.agenda.map((row, agendaIndex) => (
                          <div className="display-shabbat-prayer-row" key={`${row.content}-${agendaIndex}`}>
                            <span className="display-shabbat-prayer-label">{row.content}</span>
                            <span className="display-shabbat-prayer-time">{row.itemTime ?? ""}</span>
                          </div>
                        ))}
                      </ShabbatPrayerList>
                    </Card>
                  ) : shabbat?.prayers?.length ? (
                    <Card className="display-card display-shabbat-prayers-card">
                      <ShabbatPrayerList rowCount={shabbat.prayers.length} scaleToViewport={isVeryBold}>
                        {shabbat.prayers.map((prayer, prayerIndex) => (
                          <div className="display-shabbat-prayer-row" key={`${prayer.label}-${prayerIndex}`}>
                            <span className="display-shabbat-prayer-label">{prayer.label}</span>
                            <span className="display-shabbat-prayer-time">{prayer.time}</span>
                          </div>
                        ))}
                      </ShabbatPrayerList>
                    </Card>
                  ) : null}
                </div>
              );

              if (isVeryBold) {
                return <div className="display-shabbat-fit display-shabbat-fit--fill">{shabbatInner}</div>;
              }

              return (
                <AutoFit className="display-shabbat-fit" deps={[currentScreen, shabbat, snapshot]}>
                  {shabbatInner}
                </AutoFit>
              );
            })()}
          </section>
        ) : null}
        </div>

        {footerText ? (
          <footer className="display-footer">
            <span className="display-footer-text">{footerText}</span>
          </footer>
        ) : null}
      </div>
      )}
    </main>
  );
}

function PrimaryInfoStack({
  snapshot,
  isWoodSilverRevolution,
  hideChromeDates = false,
  amidahAddition,
  mevarchimText
}: {
  snapshot: Snapshot;
  isWoodSilverRevolution: boolean;
  hideChromeDates?: boolean;
  amidahAddition: string | null;
  mevarchimText?: string | null;
}) {
  const omerTileText = snapshot.omerShortText ?? snapshot.omerText;
  const extraTiles = [omerTileText, amidahAddition, ...(snapshot.liturgicalTiles ?? [])]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split("\n").map((line) => line.trim()).filter(Boolean));
  const lastExtraSpans = extraTiles.length % 2 === 1;
  const additionTileCount = 2 + extraTiles.length;
  const additionsClass =
    extraTiles.length >= 3
      ? "display-main-additions display-main-additions--many"
      : extraTiles.length === 1
        ? "display-main-additions display-main-additions--three"
        : extraTiles.length >= 2
          ? "display-main-additions display-main-additions--four"
          : "display-main-additions";

  return (
    <>
      <Card className="display-card display-main-date-card">
        <CardContent className="display-main-date-content !p-0">
          <p className="display-parasha">{snapshot.parasha}</p>
          {mevarchimText ? <p className="display-mevarchim">{mevarchimText}</p> : null}
          {hideChromeDates ? (
            <p className="display-gregorian-date">{snapshot.gregorianDate}</p>
          ) : (
            <>
              <p className="display-hebrew-date">{snapshot.hebrewDate}</p>
              <p className="display-gregorian-date">{snapshot.gregorianDate}</p>
            </>
          )}
        </CardContent>
      </Card>

      {isWoodSilverRevolution ? (
        <div className="display-ws-additions-shell">
          <div className="display-ws-additions-inner">
            <p className="display-addition-text">{snapshot.rainText}</p>
            <p className="display-addition-text">{snapshot.blessingText}</p>
            {extraTiles.map((text) => (
              <p key={text} className="display-addition-text">
                {text}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className={additionsClass} data-addition-count={additionTileCount}>
          <Card className="display-card">
            <CardContent className="display-addition-content !p-0">
              <p className="display-addition-text">{snapshot.rainText}</p>
            </CardContent>
          </Card>
          <Card className="display-card">
            <CardContent className="display-addition-content !p-0">
              <p className="display-addition-text">{snapshot.blessingText}</p>
            </CardContent>
          </Card>
          {extraTiles.map((text, index) => (
            <Card
              key={text}
              className={`display-card${lastExtraSpans && index === extraTiles.length - 1 ? " display-addition-single" : ""}`}
            >
              <CardContent className="display-addition-content !p-0">
                <p className="display-addition-text">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isWoodSilverRevolution ? (
        <div className="display-ws-daf-shell">
          <Card className="display-card display-daf-card display-ws-daf-card-inner">
            <CardContent className="display-daf-content !p-0">
              <div className="display-daf-yomi">
                דף יומי: <span className="display-accent">{snapshot.dafYomi}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="display-card display-daf-card">
          <CardContent className="display-daf-content !p-0">
            <div className="display-daf-yomi">
              דף יומי: <span className="display-accent">{snapshot.dafYomi}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

