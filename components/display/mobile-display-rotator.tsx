"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, BookOpen, Clock, Sun, CalendarDays, ScrollText, Megaphone, Flame, MoonStar, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { AnalogClock } from "@/components/display/analog-clock";
import { LiveClock } from "@/components/display/live-clock";
import { cn } from "@/lib/utils";
import type { DailyLearningLine } from "@/lib/hebcal";
import type { BulletinItem } from "@/lib/bulletin-board";
import type {
  DisplayPrayerSlot,
  DisplayShabbat,
  DisplayTimeSection
} from "@/lib/build-display-view";
import { fetchDisplayLiveView, pickDisplayLiveFields, useDisplayLiveRefresh, useHalachicDayLiveRefresh } from "@/lib/display-live-refresh";
import { addDaysIsoDate, toIsoDateJerusalem } from "@/lib/hebcal";
import { daysBetweenIso, relativeDayLabel, VIEW_DATE_RANGE_DAYS } from "@/lib/view-date";
import type { MobileMinyanOption, ScheduleTimesListMode } from "@/lib/display-config";
import { DEFAULT_DISPLAY_FONT, type DisplayFont } from "@/lib/display-font";
import { DEFAULT_DISPLAY_PALETTE, styleUsesPalettes, type DisplayPalette, type DisplayStyle } from "@/lib/display-theme";
import { groupPrayersForDisplay, weekdayMinchaClockTimes } from "@/lib/prayer-display-groups";
import { groupShabbatScheduleByPeriod } from "@/lib/shabbat-schedule-periods";
import { setPreferredSynagogue } from "@/lib/mobile-synagogue-preference";
import { FAST_END_LABEL, FAST_START_LABEL } from "@/lib/liturgical-additions";
import { useHideMainPrayerTimes } from "@/hooks/use-hide-main-prayer-times";
import { SiddurReader } from "@/components/mobile/siddur-reader";
import { DEFAULT_HAFTARAH_MINHAG, type HaftarahMinhag } from "@/lib/haftarah-minhag";
import { siddurPrayerFromLabel, type SiddurPrayer } from "@/lib/siddur";

type ScreenKey =
  | "main"
  | "mainInfo"
  | "clock"
  | "omer"
  | "fast"
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

type NextPrayerMark = { label: string; time: string; dayOffset: 0 | 1 };

type Snapshot = {
  hebrewDate: string;
  gregorianDate: string;
  parasha: string;
  occasionIsChag?: boolean;
  candleLighting: string | null;
  havdalah: string | null;
  dafYomi: string;
  zmanim: Array<{ label: string; time: string }>;
  halachicDayRollIso: string | null;
  chatzotIso?: string | null;
  rainText: string;
  blessingText: string;
  omerText: string | null;
  amidahAdditionText: string | null;
  liturgicalTiles?: string[];
  fastName?: string | null;
  fastStart?: string | null;
  fastEnd?: string | null;
};

type HalachaData = {
  title: string;
  text: string;
  source?: string;
  chapterNumber?: number;
  sectionNumber?: number;
  segments?: string[];
};

type MobileDisplayRotatorProps = {
  synagogueId?: string | null;
  synagogueName: string;
  minyanName: string | null;
  minyanOptions?: MobileMinyanOption[];
  currentMinyanIndex?: number;
  font?: DisplayFont;
  style?: DisplayStyle;
  palette?: DisplayPalette;
  footerText?: string | null;
  screens: RotatorScreen[];
  dailyLearning: DailyLearningLine[];
  snapshot: Snapshot;
  shabbatMevarchimText?: string | null;
  halacha: HalachaData | null;
  prayerSchedule: DisplayPrayerSlot[];
  timeSections: DisplayTimeSection[];
  timeSectionsAll?: DisplayTimeSection[];
  viewDate?: string;
  scheduleTimesListMode?: ScheduleTimesListMode;
  shabbat?: DisplayShabbat | null;
  bulletinItems?: BulletinItem[];
  haftarahMinhag?: HaftarahMinhag;
};

const SCREEN_META: Record<ScreenKey, { title: string; Icon: typeof Sparkles }> = {
  main: { title: "מניין", Icon: Sparkles },
  mainInfo: { title: "מידע מרכזי", Icon: Sparkles },
  clock: { title: "שעון", Icon: Clock },
  omer: { title: "ספירת העומר", Icon: Flame },
  fast: { title: "צום", Icon: CalendarDays },
  halacha: { title: "הלכה יומית", Icon: ScrollText },
  dailyLearning: { title: "לימוד יומי", Icon: BookOpen },
  prayerTimes: { title: "זמני תפילות", Icon: CalendarDays },
  fullSchedule: { title: "לוח זמנים מלא", Icon: CalendarDays },
  shabbat: { title: "שבת וחג", Icon: Sun },
  bulletin: { title: "לוח מודעות", Icon: Megaphone }
};

function nowJerusalemMinutes() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  return now.getHours() * 60 + now.getMinutes();
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** במסך גלילה אחד: אם אותו מידע מופיע בכמה מסכים — נשארים עם העשיר ביותר. */
function dropMobileDuplicateScreens(screens: RotatorScreen[]): RotatorScreen[] {
  const keys = new Set(screens.map((s) => s.screenKey));
  const hide = new Set<ScreenKey>();

  if (keys.has("main")) {
    hide.add("fullSchedule");
    hide.add("prayerTimes");
    hide.add("mainInfo");
    hide.add("omer");
  } else {
    if (keys.has("fullSchedule")) hide.add("prayerTimes");
    if (keys.has("mainInfo")) hide.add("omer");
  }

  if (hide.size === 0) return screens;
  return screens.filter((s) => !hide.has(s.screenKey));
}

export function MobileDisplayRotator({
  synagogueId = null,
  synagogueName: synagogueNameProp,
  minyanName: minyanNameProp,
  minyanOptions = [],
  currentMinyanIndex: currentMinyanIndexProp = 1,
  font: fontProp = DEFAULT_DISPLAY_FONT,
  style: styleProp = "classic",
  palette: paletteProp = DEFAULT_DISPLAY_PALETTE,
  footerText: footerTextProp,
  screens: screensProp,
  dailyLearning: dailyLearningProp,
  snapshot: snapshotProp,
  shabbatMevarchimText: shabbatMevarchimTextProp = null,
  halacha: halachaProp,
  prayerSchedule: prayerScheduleProp,
  timeSections: timeSectionsProp,
  timeSectionsAll: timeSectionsAllProp,
  viewDate: viewDateProp,
  scheduleTimesListMode: scheduleTimesListModeProp = "all",
  shabbat: shabbatProp = null,
  bulletinItems: bulletinItemsProp = [],
  haftarahMinhag: haftarahMinhagProp = DEFAULT_HAFTARAH_MINHAG
}: MobileDisplayRotatorProps) {
  const [live, setLive] = useState(() => ({
    synagogueName: synagogueNameProp,
    minyanName: minyanNameProp,
    font: fontProp,
    style: styleProp,
    palette: paletteProp,
    footerText: footerTextProp ?? null,
    screens: screensProp,
    dailyLearning: dailyLearningProp,
    snapshot: snapshotProp,
    shabbatMevarchimText: shabbatMevarchimTextProp,
    halacha: halachaProp,
    prayerSchedule: prayerScheduleProp,
    timeSections: timeSectionsProp,
    timeSectionsAll: timeSectionsAllProp ?? timeSectionsProp,
    viewDate: viewDateProp ?? toIsoDateJerusalem(),
    scheduleTimesListMode: scheduleTimesListModeProp,
    shabbat: shabbatProp,
    bulletinItems: bulletinItemsProp,
    haftarahMinhag: haftarahMinhagProp
  }));
  const {
    synagogueName,
    minyanName,
    font,
    style,
    palette,
    footerText,
    screens,
    dailyLearning,
    snapshot,
    shabbatMevarchimText,
    halacha,
    prayerSchedule,
    timeSections,
    timeSectionsAll,
    viewDate,
    shabbat,
    bulletinItems,
    haftarahMinhag
  } = live;
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [siddurPrayer, setSiddurPrayer] = useState<SiddurPrayer | null>(null);
  const [minyanIndex, setMinyanIndex] = useState(currentMinyanIndexProp);
  const [dayLoading, setDayLoading] = useState(false);
  const dayLoadingRef = useRef(false);
  const dayTouchRef = useRef<{ x: number } | null>(null);

  const applyView = useCallback((view: NonNullable<Awaited<ReturnType<typeof fetchDisplayLiveView>>>) => {
    const next = pickDisplayLiveFields(view);
    setLive({
      synagogueName: next.synagogueName,
      minyanName: next.minyanName,
      font: next.font ?? DEFAULT_DISPLAY_FONT,
      style: next.style ?? "classic",
      palette: next.palette ?? DEFAULT_DISPLAY_PALETTE,
      footerText: next.footerText,
      screens: next.screens,
      dailyLearning: next.dailyLearning,
      snapshot: next.snapshot,
      shabbatMevarchimText: next.shabbatMevarchimText,
      halacha: next.halacha,
      prayerSchedule: next.prayerSchedule,
      timeSections: next.timeSections,
      timeSectionsAll: next.timeSectionsAll ?? next.timeSections,
      viewDate: next.viewDate ?? toIsoDateJerusalem(),
      scheduleTimesListMode: next.scheduleTimesListMode,
      shabbat: next.shabbat,
      bulletinItems: next.bulletinItems,
      haftarahMinhag: next.haftarahMinhag ?? DEFAULT_HAFTARAH_MINHAG
    });
    const resolved = next.viewDate ?? toIsoDateJerusalem();
    const url = new URL(window.location.href);
    if (resolved === toIsoDateJerusalem()) url.searchParams.delete("date");
    else url.searchParams.set("date", resolved);
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, []);

  const refreshLive = useDisplayLiveRefresh(applyView);
  useHalachicDayLiveRefresh(snapshot.halachicDayRollIso, refreshLive);
  const hideMainTimes = useHideMainPrayerTimes({
    shabbatScreenActive: Boolean(shabbat),
    viewIso: viewDate,
    chatzotIso: snapshot.chatzotIso
  });
  const [nowMinutes, setNowMinutes] = useState(nowJerusalemMinutes);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const tick = () => setNowMinutes(nowJerusalemMinutes());
    const id = window.setInterval(tick, 15_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const accent = getComputedStyle(shell).getPropertyValue("--m-burgundy").trim();
    if (!accent) return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", accent);
  }, [style, palette]);

  const jerusalemTodayIso = toIsoDateJerusalem();
  const isViewingToday = viewDate === jerusalemTodayIso;
  const prayerOnlySections = useMemo(
    () =>
      (timeSectionsAll ?? timeSections).map((section) => ({
        ...section,
        items: section.items.filter((item) => item.kind === "prayer")
      })),
    [timeSections, timeSectionsAll]
  );
  const visibleTimeSections = showFullSchedule ? timeSectionsAll : prayerOnlySections;
  const dayOffset = daysBetweenIso(jerusalemTodayIso, viewDate);
  const canGoPrev = dayOffset > -VIEW_DATE_RANGE_DAYS;
  const canGoNext = dayOffset < VIEW_DATE_RANGE_DAYS;

  const loadViewDate = useCallback(
    async (iso: string) => {
      if (dayLoadingRef.current) return;
      dayLoadingRef.current = true;
      setDayLoading(true);
      try {
        const todayIso = toIsoDateJerusalem();
        const dateParam = iso === todayIso ? null : iso;
        const view = await fetchDisplayLiveView(15_000, { date: dateParam });
        if (!view) return;
        applyView(view);
      } finally {
        dayLoadingRef.current = false;
        setDayLoading(false);
      }
    },
    [applyView]
  );

  const loadMinyan = useCallback(
    async (ordinal: number) => {
      if (dayLoadingRef.current || ordinal === minyanIndex) return;
      dayLoadingRef.current = true;
      setDayLoading(true);
      try {
        const todayIso = toIsoDateJerusalem();
        const dateParam = viewDate === todayIso ? null : viewDate;
        const view = await fetchDisplayLiveView(15_000, {
          minyan: String(ordinal),
          date: dateParam
        });
        if (!view) return;
        applyView(view);
        setMinyanIndex(ordinal);
        const url = new URL(window.location.href);
        url.searchParams.set("minyan", String(ordinal));
        if (dateParam) url.searchParams.set("date", dateParam);
        else url.searchParams.delete("date");
        window.history.replaceState(null, "", url);
        if (synagogueId) setPreferredSynagogue({ synagogueId, minyan: String(ordinal) });
      } finally {
        dayLoadingRef.current = false;
        setDayLoading(false);
      }
    },
    [applyView, minyanIndex, synagogueId, viewDate]
  );

  const enabledScreens = useMemo(() => {
    return dropMobileDuplicateScreens(
      screens.filter((s) => {
        if (!s.enabled) return false;
        if (s.screenKey === "halacha") return false;
        if (s.screenKey === "shabbat" && !shabbat) return false;
        if (s.screenKey === "omer" && !snapshot.omerText) return false;
        if (s.screenKey === "fast" && !snapshot.fastName) return false;
        if (s.screenKey === "bulletin" && bulletinItems.length === 0) return false;
        return true;
      })
    );
  }, [screens, snapshot.omerText, snapshot.fastName, shabbat, bulletinItems.length]);

  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
  }, [viewDate]);

  const [viewYear, viewMonth, viewDay] = viewDate.split("-").map(Number);
  const viewJsDay = new Date(Date.UTC(viewYear, viewMonth - 1, viewDay, 12, 0, 0)).getUTCDay();
  const headerCandleLighting = shabbat?.candleLighting ?? snapshot.candleLighting;
  const headerHavdalah = shabbat?.havdalah ?? snapshot.havdalah;
  const showHeaderShabbatZmanim =
    (viewJsDay === 5 || viewJsDay === 6) &&
    Boolean(headerCandleLighting || headerHavdalah);
  const todayPrayers = (prayerOnlySections[0]?.items ?? [])
    .map((item) => ({ ...item, totalMinutes: toMinutes(item.time) }))
    .sort((a, b) => a.totalMinutes - b.totalMinutes);
  const tomorrowPrayers = (prayerOnlySections[1]?.items ?? [])
    .map((item) => ({ ...item, totalMinutes: toMinutes(item.time) }))
    .sort((a, b) => a.totalMinutes - b.totalMinutes);
  const nextToday = todayPrayers.find((item) => item.totalMinutes >= nowMinutes) ?? null;
  const nextPrayer: NextPrayerMark | null = !isViewingToday
    ? null
    : nextToday
      ? { label: nextToday.label, time: nextToday.time, dayOffset: 0 }
      : tomorrowPrayers[0]
        ? { label: tomorrowPrayers[0].label, time: tomorrowPrayers[0].time, dayOffset: 1 }
        : null;
  const nextSiddur = nextPrayer ? siddurPrayerFromLabel(nextPrayer.label) : null;
  const zmanimForToggle = (timeSectionsAll[0]?.items ?? []).filter((item) => item.kind === "zman");
  const dayTitle = relativeDayLabel(viewDate, jerusalemTodayIso);

  const shiftViewDate = (delta: number) => {
    const nextIso = addDaysIsoDate(viewDate, delta);
    const offset = daysBetweenIso(jerusalemTodayIso, nextIso);
    if (offset < -VIEW_DATE_RANGE_DAYS || offset > VIEW_DATE_RANGE_DAYS) return;
    void loadViewDate(nextIso);
  };

  const mainEnabled = enabledScreens.some((s) => s.screenKey === "main");
  const showHeaderMinyan = !mainEnabled && (minyanOptions.length > 1 || Boolean(minyanName));

  const renderPanel = (screenKey: ScreenKey) => (
    <>
      {screenKey === "main" ? (
        <MinyanHeading
          name={minyanName}
          options={minyanOptions}
          index={minyanIndex}
          disabled={dayLoading}
          onChange={(ordinal) => void loadMinyan(ordinal)}
        />
      ) : (
        <ScreenHeading screenKey={screenKey} />
      )}
      <div className="mt-4">
        {screenKey === "main" && (
          <MainScreen
            snapshot={snapshot}
            timeSections={hideMainTimes ? [] : visibleTimeSections}
            mevarchimText={shabbatMevarchimText}
            nextPrayer={hideMainTimes ? null : nextPrayer}
            onOpenSiddur={setSiddurPrayer}
          />
        )}
        {screenKey === "mainInfo" && (
          <MainInfoScreen
            snapshot={snapshot}
            nextPrayer={nextPrayer}
            mevarchimText={shabbatMevarchimText}
            onOpenSiddur={setSiddurPrayer}
          />
        )}
        {screenKey === "clock" && <ClockScreen nextPrayer={nextPrayer} onOpenSiddur={setSiddurPrayer} />}
        {screenKey === "omer" && <OmerScreen snapshot={snapshot} />}
        {screenKey === "fast" && (
          <FastDayScreen snapshot={snapshot} prayerSchedule={prayerSchedule} onOpenSiddur={setSiddurPrayer} />
        )}
        {screenKey === "dailyLearning" && <DailyLearningScreen lines={dailyLearning} />}
        {screenKey === "prayerTimes" && (
          <PrayerTimesScreen
            prayerSchedule={prayerSchedule}
            nowMinutes={nowMinutes}
            highlightNow={isViewingToday}
            zmanim={showFullSchedule ? zmanimForToggle : []}
            onOpenSiddur={setSiddurPrayer}
          />
        )}
        {screenKey === "fullSchedule" && (
          <FullScheduleScreen
            timeSections={visibleTimeSections}
            nowMinutes={nowMinutes}
            highlightNow={isViewingToday}
            onOpenSiddur={setSiddurPrayer}
          />
        )}
        {screenKey === "shabbat" && (
          <ShabbatScreen shabbat={shabbat} nowMinutes={nowMinutes} highlightNow={isViewingToday} />
        )}
        {screenKey === "bulletin" && <BulletinScreen items={bulletinItems} />}
      </div>
    </>
  );

  return (
    <div
      ref={shellRef}
      className="m-shell"
      data-display-font={font}
      data-display-style={style}
      data-display-palette={styleUsesPalettes(style) ? palette : undefined}
    >
      <header className="m-header">
        <div className="m-header-top">
          <div className="m-header-names">
            <div className="m-header-title-row">
              <h1>{synagogueName}</h1>
              {showHeaderMinyan ? (
                minyanOptions.length > 1 ? (
                  <label className="m-minyan-switch">
                    <span className="m-visually-hidden">בחירת מניין</span>
                    <select
                      className="m-minyan-select"
                      value={minyanIndex}
                      disabled={dayLoading}
                      onChange={(e) => void loadMinyan(Number(e.target.value))}
                    >
                      {minyanOptions.map((option) => (
                        <option key={option.index} value={option.index}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="m-minyan-caret" aria-hidden />
                  </label>
                ) : minyanName ? (
                  <p className="m-header-minyan">{minyanName}</p>
                ) : null
              ) : null}
            </div>
          </div>
          <div className="m-header-clock">
            <LiveClock className="m-header-clock-time" showSeconds={false} />
          </div>
        </div>
        <div className="m-toolbar">
          <div
            className={cn("m-day-nav", dayLoading && "m-day-nav--loading")}
            onTouchStart={(e) => {
              dayTouchRef.current = { x: e.touches[0].clientX };
            }}
            onTouchEnd={(e) => {
              const start = dayTouchRef.current;
              dayTouchRef.current = null;
              if (!start) return;
              const dx = e.changedTouches[0].clientX - start.x;
              if (Math.abs(dx) < 40) return;
              if (dx > 0) shiftViewDate(-1);
              else shiftViewDate(1);
            }}
          >
            <button
              type="button"
              className="m-day-nav-btn"
              aria-label="היום הקודם"
              disabled={!canGoPrev || dayLoading}
              onClick={() => shiftViewDate(-1)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="m-day-nav-center">
              <p className="m-day-nav-label">{dayTitle}</p>
              <p className="m-day-nav-date">{snapshot.hebrewDate}</p>
              {!isViewingToday ? (
                <button
                  type="button"
                  className="m-day-today-btn"
                  disabled={dayLoading}
                  onClick={() => void loadViewDate(jerusalemTodayIso)}
                >
                  חזרה להיום
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="m-day-nav-btn"
              aria-label="היום הבא"
              disabled={!canGoNext || dayLoading}
              onClick={() => shiftViewDate(1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            className={cn("m-schedule-toggle", showFullSchedule && "m-schedule-toggle--on")}
            aria-pressed={showFullSchedule}
            onClick={() => setShowFullSchedule((value) => !value)}
          >
            {showFullSchedule ? "הצג תפילות בלבד" : "הצג לוח זמנים מלא"}
          </button>
        </div>
        {showHeaderShabbatZmanim ? (
          <div className="m-header-shabbat">
            {headerCandleLighting ? (
              <div className="m-chip-soft">
                <Flame className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">כניסה</span>
                <span className="tabular-nums">{headerCandleLighting}</span>
              </div>
            ) : null}
            {headerHavdalah ? (
              <div className="m-chip-soft">
                <MoonStar className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">יציאה</span>
                <span className="tabular-nums">{headerHavdalah}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {nextPrayer ? (
          nextSiddur ? (
            <button
              type="button"
              className="m-next-prayer m-next-prayer--siddur"
              onClick={() => setSiddurPrayer(nextSiddur)}
            >
              <span>התפילה הבאה: {nextPrayer.label}</span>
              <span className="m-next-prayer-time">{nextPrayer.time}</span>
            </button>
          ) : (
            <div className="m-next-prayer">
              <span>התפילה הבאה: {nextPrayer.label}</span>
              <span className="m-next-prayer-time">{nextPrayer.time}</span>
            </div>
          )
        ) : null}
      </header>

      <div ref={viewportRef} className="m-viewport">
        {enabledScreens.flatMap((screen, i) => {
          const section = (
            <section key={`${screen.screenKey}-${i}`} className="m-section">
              {renderPanel(screen.screenKey)}
            </section>
          );
          if (screen.screenKey === "main") {
            return [section, <HalachaFold key="halacha-fold" halacha={halacha} />];
          }
          return [section];
        })}
        {enabledScreens.some((s) => s.screenKey === "main") ? null : <HalachaFold halacha={halacha} />}
        {footerText ? <footer className="m-footer">{footerText}</footer> : null}
        <nav className="m-bottom-nav" aria-label="ניווט">
          <Link href="/m?pick=1">החלפת בית כנסת</Link>
          <Link href="/admin/login">כניסה כמנהל</Link>
        </nav>
      </div>
      {siddurPrayer ? (
        <SiddurReader prayer={siddurPrayer} nusach={haftarahMinhag} onClose={() => setSiddurPrayer(null)} />
      ) : null}
    </div>
  );
}

function halachaSegments(halacha: HalachaData | null): string[] {
  if (!halacha) return [];
  const fromSegments = (halacha.segments ?? []).map((item) => item.trim()).filter(Boolean);
  if (fromSegments.length) return fromSegments;
  return halacha.text.trim() ? [halacha.text.trim()] : [];
}

function HalachaFold({ halacha }: { halacha: HalachaData | null }) {
  const segments = halachaSegments(halacha);
  if (!halacha || !segments.length) return null;

  return (
    <section className="m-section">
      <details className="m-halacha-fold">
        <summary className="m-halacha-fold-summary">
          <ScrollText className="h-5 w-5 shrink-0" aria-hidden />
          <span className="m-halacha-fold-title">הלכה יומית</span>
          <span className="m-halacha-fold-preview">{halacha.title}</span>
          <ChevronDown className="m-halacha-fold-caret" aria-hidden />
        </summary>
        <div className="m-halacha-fold-body">
          <h3 className="m-halacha-title">{halacha.title}</h3>
          {halacha.source ? <p className="m-halacha-meta">{halacha.source}</p> : null}
          {segments.map((text, i) => (
            <div key={`${i}-${text.slice(0, 24)}`}>
              {segments.length > 1 ? (
                <p className="m-halacha-meta">
                  סעיף {i + 1} מתוך {segments.length}
                </p>
              ) : null}
              <p className="m-halacha-body">{text}</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function ScreenHeading({ screenKey }: { screenKey: ScreenKey }) {
  const { title, Icon } = SCREEN_META[screenKey];
  return (
    <div className="m-heading">
      <Icon className="h-5 w-5" />
      <h2>{title}</h2>
      <span className="m-heading-rule" aria-hidden />
    </div>
  );
}

function MinyanHeading({
  name,
  options,
  index,
  disabled,
  onChange
}: {
  name: string | null;
  options: MobileMinyanOption[];
  index: number;
  disabled: boolean;
  onChange: (ordinal: number) => void;
}) {
  const label = name?.trim() || options.find((o) => o.index === index)?.name || null;
  if (!label && options.length === 0) return null;

  if (options.length > 1) {
    return (
      <div className="m-heading">
        <Sparkles className="h-5 w-5" aria-hidden />
        <label className="m-heading-minyan">
          <span className="m-visually-hidden">בחירת מניין</span>
          <select
            className="m-heading-minyan-select"
            value={index}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
          >
            {options.map((option) => (
              <option key={option.index} value={option.index}>
                {option.name}
              </option>
            ))}
          </select>
          <ChevronDown className="m-heading-minyan-caret" aria-hidden />
        </label>
        <span className="m-heading-rule" aria-hidden />
      </div>
    );
  }

  return (
    <div className="m-heading">
      <Sparkles className="h-5 w-5" aria-hidden />
      <h2>{label}</h2>
      <span className="m-heading-rule" aria-hidden />
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("m-card", className)}>{children}</div>;
}

function Badges({ snapshot }: { snapshot: Snapshot }) {
  const badges = [
    snapshot.rainText,
    snapshot.blessingText,
    snapshot.omerText,
    snapshot.amidahAdditionText,
    ...(snapshot.liturgicalTiles ?? []).map((text) => text.replace(/\n/g, " · "))
  ].filter(Boolean) as string[];
  if (!badges.length) return null;
  return (
    <div className="m-badge-row">
      {badges.map((text) => (
        <span key={text} className="m-badge">
          {text}
        </span>
      ))}
    </div>
  );
}

function TimeRow({
  label,
  time,
  highlight,
  onOpenSiddur
}: {
  label: string;
  time: string;
  highlight?: boolean;
  onOpenSiddur?: (prayer: SiddurPrayer) => void;
}) {
  const siddur = onOpenSiddur ? siddurPrayerFromLabel(label) : null;
  const className = cn("m-time-row", highlight && "m-time-row--next", siddur && "m-time-row--siddur");
  const inner = (
    <>
      <span className="m-time-row-label">
        {highlight ? <span className="m-time-row-badge">הבא</span> : null}
        {siddur ? <BookOpen className="m-time-row-book" aria-hidden /> : null}
        {label}
      </span>
      <span className="m-time-row-time">{time}</span>
    </>
  );
  if (siddur && onOpenSiddur) {
    return (
      <button type="button" className={className} onClick={() => onOpenSiddur(siddur)}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

function MainScreen({
  snapshot,
  timeSections,
  mevarchimText,
  nextPrayer,
  onOpenSiddur
}: {
  snapshot: Snapshot;
  timeSections: DisplayTimeSection[];
  mevarchimText?: string | null;
  nextPrayer?: NextPrayerMark | null;
  onOpenSiddur: (prayer: SiddurPrayer) => void;
}) {
  const parasha = snapshot.parasha && snapshot.parasha !== "לא נמצא" ? snapshot.parasha : null;
  return (
    <div className="space-y-4">
      {parasha ? (
        <div className="m-hero">
          <p className="m-hero-kicker">{snapshot.occasionIsChag ? "החג" : "פרשת השבוע"}</p>
          <p className="m-hero-title">{parasha}</p>
          <p className="m-hero-date">{snapshot.gregorianDate}</p>
        </div>
      ) : null}
      <Badges snapshot={snapshot} />
      {mevarchimText ? <p className="m-center m-learn-title">{mevarchimText}</p> : null}
      {timeSections.map((section, sectionIndex) => {
        if (!section.items.length) return null;
        const items = [...section.items].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
        return (
          <Card key={section.title}>
            <h3 className="m-section-title">{section.title}</h3>
            <div>
              {items.map((item, i) => (
                <TimeRow
                  key={`${item.label}-${i}`}
                  label={item.label}
                  time={item.time}
                  onOpenSiddur={item.kind === "prayer" ? onOpenSiddur : undefined}
                  highlight={
                    Boolean(
                      nextPrayer &&
                        item.kind === "prayer" &&
                        sectionIndex === nextPrayer.dayOffset &&
                        item.label === nextPrayer.label &&
                        item.time === nextPrayer.time
                    )
                  }
                />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function InfoTile({
  label,
  value,
  onClick
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <p className="m-tile-label">{label}</p>
      <p className="m-tile-value">{value}</p>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="m-card m-tile m-tile--siddur" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return (
    <Card className="m-tile">
      {inner}
    </Card>
  );
}

function MainInfoScreen({
  snapshot,
  nextPrayer,
  mevarchimText,
  onOpenSiddur
}: {
  snapshot: Snapshot;
  nextPrayer: NextPrayerMark | null;
  mevarchimText?: string | null;
  onOpenSiddur: (prayer: SiddurPrayer) => void;
}) {
  const parasha = snapshot.parasha && snapshot.parasha !== "לא נמצא" ? snapshot.parasha : null;
  const nextSiddur = nextPrayer ? siddurPrayerFromLabel(nextPrayer.label) : null;
  return (
    <div className="space-y-3">
      {parasha ? (
        <div className="m-hero">
          <p className="m-hero-kicker">{snapshot.occasionIsChag ? "החג" : "פרשת השבוע"}</p>
          <p className="m-hero-title">{parasha}</p>
          <p className="m-hero-date">{snapshot.hebrewDate}</p>
        </div>
      ) : (
        <InfoTile label="תאריך עברי" value={snapshot.hebrewDate} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <InfoTile label="דף יומי" value={snapshot.dafYomi} />
        {nextPrayer ? (
          <InfoTile
            label="התפילה הבאה"
            value={`${nextPrayer.label} ${nextPrayer.time}`}
            onClick={nextSiddur ? () => onOpenSiddur(nextSiddur) : undefined}
          />
        ) : null}
      </div>
      {mevarchimText ? (
        <Card className="m-center">
          <p className="m-learn-title">{mevarchimText}</p>
        </Card>
      ) : null}
      <Badges snapshot={snapshot} />
    </div>
  );
}

function ClockScreen({
  nextPrayer,
  onOpenSiddur
}: {
  nextPrayer: NextPrayerMark | null;
  onOpenSiddur: (prayer: SiddurPrayer) => void;
}) {
  const nextSiddur = nextPrayer ? siddurPrayerFromLabel(nextPrayer.label) : null;
  return (
    <Card className="m-clock-panel">
      <div className="display-datetime-pair">
        <AnalogClock className="display-analog-clock--mobile" />
        <div className="display-datetime-digital-col">
          <LiveClock className="display-datetime-digital display-datetime-digital--mobile" splitSeconds />
          {nextPrayer ? (
            nextSiddur ? (
              <button type="button" className="display-datetime-next-prayer m-clock-siddur" onClick={() => onOpenSiddur(nextSiddur)}>
                <span className="display-datetime-next-prayer-label">התפילה הבאה:</span>
                <span className="display-datetime-next-prayer-detail">
                  {nextPrayer.label}{" "}
                  <span className="display-datetime-next-prayer-at">
                    ב־<span dir="ltr">{nextPrayer.time}</span>
                  </span>
                </span>
              </button>
            ) : (
              <p className="display-datetime-next-prayer">
                <span className="display-datetime-next-prayer-label">התפילה הבאה:</span>
                <span className="display-datetime-next-prayer-detail">
                  {nextPrayer.label}{" "}
                  <span className="display-datetime-next-prayer-at">
                    ב־<span dir="ltr">{nextPrayer.time}</span>
                  </span>
                </span>
              </p>
            )
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function OmerScreen({ snapshot }: { snapshot: Snapshot }) {
  return (
    <Card className="m-clock-panel m-center">
      <p className="m-omer-text">{snapshot.omerText}</p>
    </Card>
  );
}

function FastDayScreen({
  snapshot,
  prayerSchedule,
  onOpenSiddur
}: {
  snapshot: Snapshot;
  prayerSchedule: DisplayPrayerSlot[];
  onOpenSiddur: (prayer: SiddurPrayer) => void;
}) {
  const minchaTimes = weekdayMinchaClockTimes(prayerSchedule);
  return (
    <div className="space-y-3">
      <Card className="m-clock-panel m-center">
        <p className="m-fast-title">{snapshot.fastName || "צום"}</p>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {snapshot.fastStart ? <InfoTile label={FAST_START_LABEL} value={snapshot.fastStart} /> : null}
        {snapshot.fastEnd ? <InfoTile label={FAST_END_LABEL} value={snapshot.fastEnd} /> : null}
      </div>
      <InfoTile
        label="תפילת מנחה"
        value={minchaTimes.length ? minchaTimes.join(" · ") : "אין שעה בלוח"}
        onClick={() => onOpenSiddur("mincha")}
      />
    </div>
  );
}

function DailyLearningScreen({ lines }: { lines: DailyLearningLine[] }) {
  if (!lines.length) {
    return <Card className="m-center m-muted">אין לימוד יומי להצגה כעת.</Card>;
  }
  return (
    <div className="space-y-2">
      {lines.map((line) => (
        <Card key={line.id} className="m-learn-row">
          <span className="m-learn-title">{line.title}</span>
          <span className="m-learn-detail">{line.detail}</span>
        </Card>
      ))}
    </div>
  );
}

function FullScheduleScreen({
  timeSections,
  nowMinutes,
  highlightNow,
  onOpenSiddur
}: {
  timeSections: DisplayTimeSection[];
  nowMinutes: number;
  highlightNow: boolean;
  onOpenSiddur: (prayer: SiddurPrayer) => void;
}) {
  const timeline = [
    ...(timeSections[0]?.items ?? []).map((row) => ({
      ...row,
      totalMinutes: toMinutes(row.time),
      dayOffset: 0 as const,
      dayTag: null as string | null
    })),
    ...(timeSections[1]?.items ?? []).map((row) => ({
      ...row,
      totalMinutes: toMinutes(row.time),
      dayOffset: 1 as const,
      dayTag: "מחר" as string | null
    }))
  ].sort((a, b) => a.dayOffset - b.dayOffset || a.totalMinutes - b.totalMinutes);

  if (!timeline.length) {
    return <Card className="m-center m-muted">אין זמנים להצגה.</Card>;
  }

  const nextLocalIdx = highlightNow
    ? timeline.findIndex((row) => row.dayOffset > 0 || row.totalMinutes >= nowMinutes)
    : -1;

  return (
    <div className="flex flex-wrap items-stretch justify-center gap-y-3" dir="rtl">
      {timeline.map((row, i) => {
        const isPrayer = row.kind === "prayer";
        const isNext = i === nextLocalIdx;
        const isPast = nextLocalIdx === -1 ? true : i < nextLocalIdx;
        const siddur = isPrayer ? siddurPrayerFromLabel(row.label) : null;
        const tileClass = cn(
          "m-schedule-tile",
          isPrayer && "m-schedule-tile--prayer",
          isNext && "m-schedule-tile--next",
          isPast && !isNext && "m-schedule-tile--past",
          siddur && "m-schedule-tile--siddur"
        );
        const tileInner = (
          <>
            {isNext ? <span className="m-tag m-tag--next">הבא</span> : null}
            {row.dayTag ? <span className="m-tag m-tag--day">{row.dayTag}</span> : null}
            <div className={cn("m-schedule-label", isNext && "pt-3")}>
              {isPrayer ? `תפילת ${row.label}` : row.label}
            </div>
            <div className="m-schedule-time">{row.time}</div>
          </>
        );
        return (
          <div key={`${row.dayOffset}-${row.kind}-${row.label}-${row.time}-${i}`} className="flex min-w-0 items-stretch">
            {i > 0 ? (
              <div
                className={cn("flex w-5 shrink-0 items-center justify-center", isNext ? "text-[var(--m-gold)]" : "text-[var(--m-line)]")}
                aria-hidden
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
              </div>
            ) : null}
            {siddur ? (
              <button type="button" className={tileClass} onClick={() => onOpenSiddur(siddur)}>
                {tileInner}
              </button>
            ) : (
              <div className={tileClass}>{tileInner}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PrayerTimesScreen({
  prayerSchedule,
  nowMinutes,
  highlightNow,
  zmanim = [],
  onOpenSiddur
}: {
  prayerSchedule: DisplayPrayerSlot[];
  nowMinutes: number;
  highlightNow: boolean;
  zmanim?: Array<{ label: string; time: string }>;
  onOpenSiddur: (prayer: SiddurPrayer) => void;
}) {
  const groups = groupPrayersForDisplay(prayerSchedule);
  const nextTotalMinutes = highlightNow
    ? groups
        .flatMap((group) => group.rows)
        .filter((row) => row.totalMinutes >= nowMinutes)
        .sort((a, b) => a.totalMinutes - b.totalMinutes)[0]?.totalMinutes
    : undefined;

  if (!groups.length && !zmanim.length) {
    return <Card className="m-center m-muted">אין תפילות להיום.</Card>;
  }

  return (
    <Card>
      <div className="space-y-2">
        {groups.map(({ group, title, rows: groupRows }) => {
          const siddur = siddurPrayerFromLabel(title, groupRows[0]?.prayerType);
          return (
            <div key={group} className="m-prayer-group">
              {siddur ? (
                <button type="button" className="m-prayer-group-open" onClick={() => onOpenSiddur(siddur)}>
                  <span className={cn("m-prayer-group-title", title.length > 8 && "m-prayer-group-title--wide")}>
                    {title}
                  </span>
                  <BookOpen className="m-prayer-group-book" aria-hidden />
                  <span className="m-prayer-chips">
                    {groupRows.map((row, i) => {
                      const isNext = row.totalMinutes === nextTotalMinutes;
                      return (
                        <span key={`${group}-${row.time}-${i}`} className={cn("m-chip", isNext && "m-chip--next")}>
                          {row.time}
                        </span>
                      );
                    })}
                  </span>
                </button>
              ) : (
                <>
                  <span className={cn("m-prayer-group-title", title.length > 8 && "m-prayer-group-title--wide")}>
                    {title}
                  </span>
                  <div className="m-prayer-chips">
                    {groupRows.map((row, i) => {
                      const isNext = row.totalMinutes === nextTotalMinutes;
                      return (
                        <span key={`${group}-${row.time}-${i}`} className={cn("m-chip", isNext && "m-chip--next")}>
                          {row.time}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {zmanim.length ? (
          <div>
            <h3 className="m-section-title">זמני היום</h3>
            {zmanim.map((item, i) => (
              <TimeRow key={`${item.label}-${i}`} label={item.label} time={item.time} />
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function ShabbatScreen({
  shabbat,
  nowMinutes,
  highlightNow
}: {
  shabbat: DisplayShabbat | null;
  nowMinutes: number;
  highlightNow: boolean;
}) {
  if (!shabbat) {
    return <Card className="m-center m-muted">אין נתוני שבת או חג להצגה כעת.</Card>;
  }
  const agendaDays = (shabbat.agendaDays ?? []).filter((day) => day.items.length);
  const fallbackRows = shabbat.agenda?.length
    ? shabbat.agenda.map((row) => ({ label: row.content, time: row.itemTime ?? "" }))
    : (shabbat.prayers ?? []).map((row) => ({ label: row.label, time: row.time }));
  const dayBoards = agendaDays.length
    ? agendaDays.map((day) => ({
        key: `day-${day.day}`,
        title: day.title,
        weekdayChag: day.weekdayChag,
        isChag: day.isChag,
        isLastDay: day.isLastDay,
        isSaturday: day.isSaturday,
        rows: day.items.map((item) => ({ label: item.content, time: item.itemTime ?? "" }))
      }))
    : fallbackRows.length
      ? [
          {
            key: "single",
            title: "",
            weekdayChag: Boolean(shabbat.isChag && !shabbat.isShabbatWeekend),
            isChag: Boolean(shabbat.isChag),
            isLastDay: true,
            isSaturday: Boolean(shabbat.isShabbatWeekend && !shabbat.isChag) || Boolean(shabbat.isShabbatWeekend),
            rows: fallbackRows
          }
        ]
      : [];
  const nextShabbat = highlightNow
    ? dayBoards
        .flatMap((board) => board.rows.map((row) => ({ ...row, boardKey: board.key, totalMinutes: toMinutes(row.time) })))
        .filter((row) => row.time && Number.isFinite(row.totalMinutes))
        .sort((a, b) => a.totalMinutes - b.totalMinutes)
        .find((row) => row.totalMinutes >= nowMinutes) ?? null
    : null;
  return (
    <div className="space-y-3">
      <div className="m-hero">
        <p className="m-hero-kicker">{shabbat.isChag ? "החג" : "פרשת השבוע"}</p>
        <p className="m-hero-title">{shabbat.parasha}</p>
        {shabbat.isChag && shabbat.isShabbatWeekend ? <p className="m-hero-date">שבת</p> : null}
        {shabbat.mevarchimText ? <p className="m-hero-date">{shabbat.mevarchimText}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {shabbat.candleLighting ? (
          <InfoTile label={shabbat.candleLabel || "הדלקת נרות"} value={shabbat.candleLighting} />
        ) : null}
        {shabbat.havdalah ? (
          <InfoTile label={shabbat.havdalahLabel || "צאת השבת"} value={shabbat.havdalah} />
        ) : null}
      </div>
      {dayBoards.map((board) => {
        const periods = groupShabbatScheduleByPeriod(board.rows, {
          weekdayChag: board.weekdayChag,
          isChag: board.isChag,
          isLastDay: board.isLastDay,
          isSaturday: board.isSaturday
        });
        return (
          <div key={board.key} className="space-y-2">
            {board.title ? <h3 className="m-section-title">{board.title}</h3> : null}
            {periods.map((column) => (
              <Card key={`${board.key}-${column.id}`}>
                <h3 className="m-section-title">{column.title}</h3>
                <div>
                  {column.rows.map((row, i) => (
                    <TimeRow
                      key={`${column.id}-${row.label}-${i}`}
                      label={row.label}
                      time={row.time}
                      highlight={Boolean(
                        nextShabbat &&
                          board.key === nextShabbat.boardKey &&
                          row.label === nextShabbat.label &&
                          row.time === nextShabbat.time
                      )}
                    />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function BulletinScreen({ items }: { items: BulletinItem[] }) {
  if (!items.length) {
    return <Card className="m-center m-muted">אין הודעות בלוח המודעות.</Card>;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          {item.kind === "image" && item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.title?.trim() || "פרסום בלוח המודעות"} className="m-bulletin-image" />
          ) : null}
          {item.title?.trim() ? <h3 className="m-halacha-title">{item.title}</h3> : null}
          {item.bodyText?.trim() ? <p className="m-halacha-body">{item.bodyText}</p> : null}
        </Card>
      ))}
    </div>
  );
}
