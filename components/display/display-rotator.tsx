"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LiveClock } from "@/components/display/live-clock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DailyLearningLine } from "@/lib/hebcal";

type ScreenKey = "main" | "clock" | "halacha" | "dailyLearning" | "prayerTimes";
type DisplayStyle = "classic" | "modern" | "minimal" | "woodSilver";

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
  showYaalehVeyavo: boolean;
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

export function DisplayRotator({
  style,
  synagogueId,
  synagogueName,
  minyanName,
  screens,
  dailyLearning,
  snapshot,
  halacha,
  prayerSchedule,
  timeSections
}: {
  style: DisplayStyle;
  synagogueId: string | null;
  synagogueName: string;
  minyanName: string | null;
  screens: RotatorScreen[];
  dailyLearning: DailyLearningLine[];
  snapshot: Snapshot;
  halacha: { title: string; text: string; source?: string; chapterNumber?: number; sectionNumber?: number } | null;
  prayerSchedule: PrayerSlot[];
  timeSections: TimeSection[];
}) {
  const router = useRouter();
  const enabledScreens = useMemo(() => screens.filter((s) => s.enabled), [screens]);
  const [index, setIndex] = useState(0);
  const timesScrollRef = useRef<HTMLDivElement | null>(null);
  const [timesStartOffset, setTimesStartOffset] = useState<number | null>(null);

  useEffect(() => {
    if (!enabledScreens.length) return;
    const current = enabledScreens[index % enabledScreens.length];
    const durationMs = Math.max(5, current.durationSeconds) * 1000;
    const timer = setTimeout(() => setIndex((prev) => (prev + 1) % enabledScreens.length), durationMs);
    return () => clearTimeout(timer);
  }, [enabledScreens, index]);

  useEffect(() => {
    // Keep unattended displays up-to-date without full page reload.
    const refreshIntervalMs = 5 * 60 * 1000;
    const intervalId = setInterval(() => {
      router.refresh();
    }, refreshIntervalMs);

    // Force refresh exactly at local midnight (Israel), then continue normal interval refresh.
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const midnightTimeoutMs = Math.max(1000, nextMidnight.getTime() - now.getTime());
    const midnightTimeoutId = setTimeout(() => {
      router.refresh();
    }, midnightTimeoutMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(intervalId);
      clearTimeout(midnightTimeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  useEffect(() => {
    const iso = snapshot.halachicDayRollIso;
    if (!iso) return;
    const delay = new Date(iso).getTime() - Date.now();
    if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
    const id = setTimeout(() => router.refresh(), delay);
    return () => clearTimeout(id);
  }, [snapshot.halachicDayRollIso, router]);

  const currentScreen = enabledScreens.length ? enabledScreens[index % enabledScreens.length].screenKey : null;
  const isWoodSilverRevolution = style === "woodSilver" && ENABLE_WOOD_SILVER_REVOLUTION_LAYOUT;
  const jerusalemWeekdayLong = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    timeZone: "Asia/Jerusalem"
  }).format(new Date());
  const nowJerusalem = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const nowMinutes = nowJerusalem.getHours() * 60 + nowJerusalem.getMinutes();
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
    if (!pastAllTodaySlots) {
      if (!todayPrayerTimes.length) return null;
      const idx = todayPrayerTimes.findIndex((item) => item.totalMinutes >= nowMinutes);
      return idx === -1 ? todayPrayerTimes[0] : todayPrayerTimes[idx];
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
    const rows: Row[] = prayerSchedule.map((row) => {
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
    return PRAYER_TIMES_GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => ({
      group,
      title: PRAYER_TIMES_GROUP_TITLES[group],
      rows: byGroup.get(group)!
    }));
  }, [prayerSchedule]);
  const prayerTimesNextBanner =
    nextTodayPrayerHighlight &&
    (() => {
      const h = nextTodayPrayerHighlight;
      const gid = prayerTimesGroupIdFromLabel(h.label);
      const sectionTitle = PRAYER_TIMES_GROUP_TITLES[gid];
      return `התפילה הבאה: ${sectionTitle} - ${h.time}`;
    })();
  const hasOmer = Boolean(snapshot.omerText);
  const hasYaaleh = snapshot.showYaalehVeyavo;
  const hasBothExtraAdditions = hasOmer && hasYaaleh;
  const shouldAutoScroll = currentScreen === "main" && timeSections.length > 0 && !isWoodSilverRevolution;
  const halachaClosingLinePattern = /["״']?\s*כל השונה הלכות בכל יום\s+מובטח לו שהוא בן העולם הבא["״']?\s*$/;
  const halachaText = halacha
    ? (() => {
        const raw = halacha.text.trim();
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
    <main className={`display display--${style}`}>
      {!enabledScreens.length ? (
        <div className="display-empty">אין מסכים פעילים לתצוגה</div>
      ) : (
      <div className="display-frame">
        <header className={cn("display-header", isWoodSilverRevolution && "display-header--ws-revolution")}>
          {isWoodSilverRevolution ? (
            <div
              className="display-ws-header-band"
              role="status"
              aria-label={`מסך ${index + 1} מתוך ${enabledScreens.length}: ${jerusalemWeekdayLong}, ${snapshot.hebrewDate}`}
            >
              <div className="display-ws-lozenge display-ws-lozenge--day">{jerusalemWeekdayLong}</div>
              {adminHref ? (
                <Link
                  href={adminHref}
                  className="display-ws-clock-circle display-clock-admin-hit"
                  aria-label="מעבר לממשק ניהול בית הכנסת"
                  prefetch={false}
                >
                  <LiveClock />
                </Link>
              ) : (
                <div className="display-ws-clock-circle">
                  <LiveClock />
                </div>
              )}
              <div className="display-ws-lozenge display-ws-lozenge--hebrew-date">{snapshot.hebrewDate}</div>
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
              {currentScreen !== "clock" ? (
                adminHref ? (
                  <Link
                    href={adminHref}
                    className="display-header-clock display-clock-admin-hit"
                    aria-label="מעבר לממשק ניהול בית הכנסת"
                    prefetch={false}
                  >
                    <LiveClock />
                  </Link>
                ) : (
                  <div className="display-header-clock">
                    <LiveClock />
                  </div>
                )
              ) : (
                <div aria-hidden className="display-header-clock-placeholder" />
              )}
            </>
          )}
        </header>

        {currentScreen === "clock" ? (
          <section
            className={cn(
              "display-clock-screen display-card",
              isWoodSilverRevolution && "display-clock-screen--ws-revolution"
            )}
          >
            {!isWoodSilverRevolution ? (
              adminHref ? (
                <Link
                  href={adminHref}
                  className="display-clock-admin-hit display-clock-screen-clock-link"
                  aria-label="מעבר לממשק ניהול בית הכנסת"
                  prefetch={false}
                >
                  <LiveClock />
                </Link>
              ) : (
                <LiveClock />
              )
            ) : null}
            {!isWoodSilverRevolution ? <p className="display-date-hebrew">{snapshot.hebrewDate}</p> : null}
            <p className="display-date-gregorian">{snapshot.gregorianDate}</p>
            {snapshot.omerText ? <p className="display-omer-line">{snapshot.omerText}</p> : null}
          </section>
        ) : null}

        {currentScreen === "halacha" ? (
          <Card className="display-card">
            {halacha && halachaText ? (
              <>
                <CardHeader>
                  <CardTitle className="display-halacha-title display-halacha-title-row">
                    <span>{halachaHeaderLabel}</span>
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
                <p className="display-daily-learning-empty">אין זמני תפילה מוגדרים להיום.</p>
              ) : (
                <div className="display-prayer-times-groups">
                  {prayerTimesScreenGroups.map(({ group, title, rows }) => (
                    <div key={group} className="display-prayer-times-group">
                      <div className="display-time-section-title">{title}</div>
                      <div className="display-prayer-times-row-line" dir="rtl">
                        {rows.map((item, idx) => {
                          const isNext =
                            nextTodayPrayerHighlight !== null &&
                            nextTodayPrayerHighlight.label === item.label &&
                            nextTodayPrayerHighlight.time === item.time;
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
                                <div className="display-time-details display-prayer-times-cell-detail">
                                  {item.details}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {currentScreen === "main" ? (
          <section className={cn("display-main-grid", isWoodSilverRevolution && "display-main-grid--ws-revolution")}>
            <div className="display-main-primary">
              <div className="display-main-primary-stack">
                <Card className="display-card display-main-date-card">
                  <CardContent className="display-main-date-content">
                    <p className="display-parasha">{snapshot.parasha}</p>
                    {isWoodSilverRevolution ? (
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
                      {snapshot.omerText ? <p className="display-addition-text">{snapshot.omerText}</p> : null}
                      {snapshot.showYaalehVeyavo ? <p className="display-addition-text">יעלה ויבוא</p> : null}
                    </div>
                  </div>
                ) : (
                  <div className="display-main-additions">
                    <Card className="display-card">
                      <CardContent className="display-addition-content">
                        <p className="display-addition-text">{snapshot.rainText}</p>
                      </CardContent>
                    </Card>
                    <Card className="display-card">
                      <CardContent className="display-addition-content">
                        <p className="display-addition-text">{snapshot.blessingText}</p>
                      </CardContent>
                    </Card>
                    {snapshot.omerText ? (
                      <Card className={`display-card ${hasBothExtraAdditions ? "" : "display-addition-single"}`}>
                        <CardContent className="display-addition-content">
                          <p className="display-addition-text">{snapshot.omerText}</p>
                        </CardContent>
                      </Card>
                    ) : null}
                    {snapshot.showYaalehVeyavo ? (
                      <Card className={`display-card ${hasBothExtraAdditions ? "" : "display-addition-single"}`}>
                        <CardContent className="display-addition-content">
                          <p className="display-addition-text">יעלה ויבוא</p>
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                )}

                {isWoodSilverRevolution ? (
                  <div className="display-ws-daf-shell">
                    <Card className="display-card display-daf-card display-ws-daf-card-inner">
                      <CardContent className="display-daf-content">
                        <div className="display-daf-yomi">
                          דף יומי: <span className="display-accent">{snapshot.dafYomi}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="display-card display-daf-card">
                    <CardContent className="display-daf-content">
                      <div className="display-daf-yomi">
                        דף יומי: <span className="display-accent">{snapshot.dafYomi}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {!isWoodSilverRevolution ? (
            <Card className="display-card display-main-times-card">
              <CardHeader>
                <CardTitle className="display-times-title">זמני היום ותפילות</CardTitle>
                {nextPrayer ? (
                  <p className="display-next-prayer">
                    התפילה הבאה: {nextPrayer.label} - {nextPrayer.time}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="display-times-content">
                <div ref={timesScrollRef} className="display-times-list">
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
            </Card>
            ) : null}
          </section>
        ) : null}
      </div>
      )}
    </main>
  );
}

