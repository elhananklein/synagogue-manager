"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveClock } from "@/components/display/live-clock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ScreenKey = "main" | "clock" | "halacha";
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

export function DisplayRotator({
  style,
  synagogueName,
  minyanName,
  screens,
  snapshot,
  halacha,
  prayerSchedule,
  timeSections
}: {
  style: DisplayStyle;
  synagogueName: string;
  minyanName: string | null;
  screens: RotatorScreen[];
  snapshot: Snapshot;
  halacha: { title: string; text: string };
  prayerSchedule: PrayerSlot[];
  timeSections: TimeSection[];
}) {
  const router = useRouter();
  const enabledScreens = useMemo(() => screens.filter((s) => s.enabled), [screens]);
  const [index, setIndex] = useState(0);
  const timesScrollRef = useRef<HTMLDivElement | null>(null);

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
  const nowJerusalem = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const nowMinutes = nowJerusalem.getHours() * 60 + nowJerusalem.getMinutes();
  const todaySectionItems = timeSections[0]?.items ?? [
    ...snapshot.zmanim.map((row) => ({ label: row.label, time: row.time, kind: "zman" as const })),
    ...prayerSchedule.map((row) => ({ label: row.label, time: row.time, details: row.details, kind: "prayer" as const }))
  ];
  const todayMergedTimes = todaySectionItems
    .map((row) => {
      const [h, m] = row.time.split(":").map(Number);
      return { ...row, totalMinutes: h * 60 + m };
    })
    .sort((a, b) => a.totalMinutes - b.totalMinutes);
  const nextIndex = todayMergedTimes.findIndex((item) => item.totalMinutes >= nowMinutes);
  const nextSlotIndex = nextIndex === -1 ? 0 : nextIndex;
  const todayPrayerTimes = todayMergedTimes.filter((item) => item.kind === "prayer");
  const nextPrayer = (() => {
    if (!todayPrayerTimes.length) return null;
    const idx = todayPrayerTimes.findIndex((item) => item.totalMinutes >= nowMinutes);
    return idx === -1 ? todayPrayerTimes[0] : todayPrayerTimes[idx];
  })();
  const hasOmer = Boolean(snapshot.omerText);
  const hasYaaleh = snapshot.showYaalehVeyavo;
  const hasBothExtraAdditions = hasOmer && hasYaaleh;
  const shouldAutoScroll = currentScreen === "main" && timeSections.length > 0;
  const halachaClosingLinePattern = /["״']?\s*כל השונה הלכות בכל יום\s+מובטח לו שהוא בן העולם הבא["״']?\s*$/;
  const halachaText = (() => {
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
  })();

  return (
    <main className={`display display--${style}`}>
      {!enabledScreens.length ? (
        <div className="display-empty">אין מסכים פעילים לתצוגה</div>
      ) : (
      <div className="display-frame">
        <header className="display-header">
          <p className="display-counter">
            מסך {index + 1}/{enabledScreens.length}
          </p>
          <h1 className="display-title">
            {minyanName ? `${synagogueName} - ${minyanName}` : synagogueName}
          </h1>
          {currentScreen !== "clock" ? (
            <div className="display-header-clock">
              <LiveClock />
            </div>
          ) : (
            <div aria-hidden className="display-header-clock-placeholder" />
          )}
        </header>

        {currentScreen === "clock" ? (
          <section className="display-clock-screen display-card">
            <LiveClock />
            <p className="display-date-hebrew">{snapshot.hebrewDate}</p>
            <p className="display-date-gregorian">{snapshot.gregorianDate}</p>
            {snapshot.omerText ? <p className="display-omer-line">{snapshot.omerText}</p> : null}
          </section>
        ) : null}

        {currentScreen === "halacha" ? (
          <Card className="display-card">
            <CardHeader>
              <CardTitle className="display-halacha-title display-halacha-title-row">
                <span>{halacha.title}</span>
                <span className="display-halacha-source">(ילקוט יוסף)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="display-halacha-text">
                {halachaText.intro ? <span className="display-halacha-intro">{halachaText.intro}</span> : null}
                {halachaText.intro ? <br /> : null}
                {halachaText.body}
                {halachaText.closingLine ? <span className="display-halacha-signature">{halachaText.closingLine}</span> : null}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {currentScreen === "main" ? (
          <section className="display-main-grid">
            <div className="display-main-primary">
              <div className="display-main-primary-stack">
                <Card className="display-card display-main-date-card">
                  <CardContent className="display-main-date-content">
                    <p className="display-parasha">{snapshot.parasha}</p>
                    <p className="display-hebrew-date">{snapshot.hebrewDate}</p>
                    <p className="display-gregorian-date">{snapshot.gregorianDate}</p>
                  </CardContent>
                </Card>

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

                <Card className="display-card display-daf-card">
                  <CardContent className="display-daf-content">
                    <div className="display-daf-yomi">
                      דף יומי: <span className="display-accent">{snapshot.dafYomi}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

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
                  <div className={shouldAutoScroll ? "display-times-track display-times-track--auto" : "display-times-track"}>
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
                          const isTodaySection = sectionIndex === 0;
                          const isNext = isTodaySection && idx === nextSlotIndex;
                          const isPrayer = item.kind === "prayer";
                          return (
                            <div
                              key={`${sectionIndex}-${item.kind}-${item.label}-${item.time}-${idx}`}
                              className={`display-time-row ${isPrayer ? "display-time-row--prayer" : ""} ${isNext ? "display-time-row--next" : ""}`}
                            >
                              <div className="display-time-main">
                                <span className={isPrayer ? "display-time-label display-time-label--prayer" : "display-time-label"}>
                                  {item.label}
                                  {isPrayer ? <span className="display-prayer-badge">תפילה</span> : null}
                                </span>
                                <span className={isNext ? "display-time-value display-time-value--next" : "display-time-value"}>{item.time}</span>
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
                          const isTodaySection = sectionIndex === 0;
                          const isNext = isTodaySection && idx === nextSlotIndex;
                          const isPrayer = item.kind === "prayer";
                          return (
                            <div
                              key={`dup-${sectionIndex}-${item.kind}-${item.label}-${item.time}-${idx}`}
                              className={`display-time-row ${isPrayer ? "display-time-row--prayer" : ""} ${isNext ? "display-time-row--next" : ""}`}
                            >
                              <div className="display-time-main">
                                <span className={isPrayer ? "display-time-label display-time-label--prayer" : "display-time-label"}>
                                  {item.label}
                                  {isPrayer ? <span className="display-prayer-badge">תפילה</span> : null}
                                </span>
                                <span className={isNext ? "display-time-value display-time-value--next" : "display-time-value"}>{item.time}</span>
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
          </section>
        ) : null}
      </div>
      )}
    </main>
  );
}

