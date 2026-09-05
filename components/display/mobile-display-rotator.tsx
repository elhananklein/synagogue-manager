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
import { setPreferredSynagogue } from "@/lib/mobile-synagogue-preference";

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
  amidahAdditionText: string | null;
  liturgicalTiles?: string[];
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
};

const SCREEN_META: Record<ScreenKey, { title: string; Icon: typeof Sparkles }> = {
  main: { title: "מניין", Icon: Sparkles },
  mainInfo: { title: "מידע מרכזי", Icon: Sparkles },
  clock: { title: "שעון", Icon: Clock },
  omer: { title: "ספירת העומר", Icon: Flame },
  halacha: { title: "הלכה יומית", Icon: ScrollText },
  dailyLearning: { title: "לימוד יומי", Icon: BookOpen },
  prayerTimes: { title: "זמני תפילות", Icon: CalendarDays },
  fullSchedule: { title: "לוח זמנים מלא", Icon: CalendarDays },
  shabbat: { title: "שבת", Icon: Sun },
  bulletin: { title: "לוח מודעות", Icon: Megaphone }
};

const PRAYER_GROUP_ORDER = ["שחרית", "מנחה", "ערבית", "אחר"] as const;
type PrayerGroupId = (typeof PRAYER_GROUP_ORDER)[number];

const PRAYER_GROUP_TITLES: Record<PrayerGroupId, string> = {
  שחרית: "שחרית",
  מנחה: "מנחה",
  ערבית: "ערבית",
  אחר: "נוספות"
};

function prayerGroupIdFromLabel(label: string): PrayerGroupId {
  const t = label.trim();
  if (t.includes("שחרית")) return "שחרית";
  if (t.includes("מנחה")) return "מנחה";
  if (t.includes("ערבית")) return "ערבית";
  return "אחר";
}

function prayerGroupTitle(group: PrayerGroupId, rows: Array<{ label: string }>): string {
  if (group === "מנחה" && rows.length > 0 && rows.every((r) => r.label.includes("ערב שבת"))) {
    return rows[0]!.label;
  }
  return PRAYER_GROUP_TITLES[group];
}

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
  bulletinItems: bulletinItemsProp = []
}: MobileDisplayRotatorProps) {
  const [live, setLive] = useState(() => ({
    synagogueName: synagogueNameProp,
    minyanName: minyanNameProp,
    font: fontProp,
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
    bulletinItems: bulletinItemsProp
  }));
  const {
    synagogueName,
    minyanName,
    font,
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
    bulletinItems
  } = live;
  const [showFullSchedule, setShowFullSchedule] = useState(false);
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
      bulletinItems: next.bulletinItems
    });
    const resolved = next.viewDate ?? toIsoDateJerusalem();
    const url = new URL(window.location.href);
    if (resolved === toIsoDateJerusalem()) url.searchParams.delete("date");
    else url.searchParams.set("date", resolved);
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, []);

  const refreshLive = useDisplayLiveRefresh(applyView);
  useHalachicDayLiveRefresh(snapshot.halachicDayRollIso, refreshLive);

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
    const [year, month, day] = viewDate.split("-").map(Number);
    const jsDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
    const isFriOrSat = jsDay === 5 || jsDay === 6;
    return dropMobileDuplicateScreens(
      screens.filter((s) => {
        if (!s.enabled) return false;
        if (s.screenKey === "halacha") return false;
        if (s.screenKey === "shabbat" && !isFriOrSat) return false;
        if (s.screenKey === "omer" && !snapshot.omerText) return false;
        return true;
      })
    );
  }, [screens, snapshot.omerText, viewDate]);

  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
  }, [viewDate]);

  const nowMinutes = nowJerusalemMinutes();
  const [viewYear, viewMonth, viewDay] = viewDate.split("-").map(Number);
  const viewJsDay = new Date(Date.UTC(viewYear, viewMonth - 1, viewDay, 12, 0, 0)).getUTCDay();
  const headerCandleLighting = shabbat?.candleLighting ?? snapshot.candleLighting;
  const headerHavdalah = shabbat?.havdalah ?? snapshot.havdalah;
  const showHeaderShabbatZmanim =
    (viewJsDay === 5 || viewJsDay === 6) &&
    Boolean(headerCandleLighting || headerHavdalah);
  const todayPrayers = (timeSections[0]?.items ?? [])
    .filter((item) => item.kind === "prayer")
    .map((item) => ({ ...item, totalMinutes: toMinutes(item.time) }))
    .sort((a, b) => a.totalMinutes - b.totalMinutes);
  const nextPrayer =
    isViewingToday ? todayPrayers.find((item) => item.totalMinutes >= nowMinutes) ?? null : null;
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
            timeSections={visibleTimeSections}
            mevarchimText={shabbatMevarchimText}
            nextPrayer={nextPrayer}
          />
        )}
        {screenKey === "mainInfo" && (
          <MainInfoScreen snapshot={snapshot} nextPrayer={nextPrayer} mevarchimText={shabbatMevarchimText} />
        )}
        {screenKey === "clock" && <ClockScreen nextPrayer={nextPrayer} />}
        {screenKey === "omer" && <OmerScreen snapshot={snapshot} />}
        {screenKey === "dailyLearning" && <DailyLearningScreen lines={dailyLearning} />}
        {screenKey === "prayerTimes" && (
          <PrayerTimesScreen
            prayerSchedule={prayerSchedule}
            nowMinutes={nowMinutes}
            highlightNow={isViewingToday}
            zmanim={showFullSchedule ? zmanimForToggle : []}
          />
        )}
        {screenKey === "fullSchedule" && (
          <FullScheduleScreen
            timeSections={visibleTimeSections}
            nowMinutes={nowMinutes}
            highlightNow={isViewingToday}
          />
        )}
        {screenKey === "shabbat" && <ShabbatScreen shabbat={shabbat} />}
        {screenKey === "bulletin" && <BulletinScreen items={bulletinItems} />}
      </div>
    </>
  );

  return (
    <div className="m-shell" data-display-font={font}>
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
          <div className="m-next-prayer">
            <span>התפילה הבאה: {nextPrayer.label}</span>
            <span className="m-next-prayer-time">{nextPrayer.time}</span>
          </div>
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

function TimeRow({ label, time, highlight }: { label: string; time: string; highlight?: boolean }) {
  return (
    <div className={cn("m-time-row", highlight && "m-time-row--next")}>
      <span>{label}</span>
      <span className="m-time-row-time">{time}</span>
    </div>
  );
}

function MainScreen({
  snapshot,
  timeSections,
  mevarchimText,
  nextPrayer
}: {
  snapshot: Snapshot;
  timeSections: DisplayTimeSection[];
  mevarchimText?: string | null;
  nextPrayer?: { label: string; time: string } | null;
}) {
  const parasha = snapshot.parasha && snapshot.parasha !== "לא נמצא" ? snapshot.parasha : null;
  return (
    <div className="space-y-4">
      {parasha ? (
        <div className="m-hero">
          <p className="m-hero-kicker">פרשת השבוע</p>
          <p className="m-hero-title">{parasha}</p>
          <p className="m-hero-date">{snapshot.gregorianDate}</p>
        </div>
      ) : null}
      <Badges snapshot={snapshot} />
      {mevarchimText ? <p className="m-center m-learn-title">{mevarchimText}</p> : null}
      {timeSections.map((section) => {
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
                  highlight={
                    Boolean(
                      nextPrayer &&
                        item.kind === "prayer" &&
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

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="m-tile">
      <p className="m-tile-label">{label}</p>
      <p className="m-tile-value">{value}</p>
    </Card>
  );
}

function MainInfoScreen({
  snapshot,
  nextPrayer,
  mevarchimText
}: {
  snapshot: Snapshot;
  nextPrayer: { label: string; time: string } | null;
  mevarchimText?: string | null;
}) {
  const parasha = snapshot.parasha && snapshot.parasha !== "לא נמצא" ? snapshot.parasha : null;
  return (
    <div className="space-y-3">
      {parasha ? (
        <div className="m-hero">
          <p className="m-hero-kicker">פרשת השבוע</p>
          <p className="m-hero-title">{parasha}</p>
          <p className="m-hero-date">{snapshot.hebrewDate}</p>
        </div>
      ) : (
        <InfoTile label="תאריך עברי" value={snapshot.hebrewDate} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <InfoTile label="דף יומי" value={snapshot.dafYomi} />
        {nextPrayer ? <InfoTile label="התפילה הבאה" value={`${nextPrayer.label} ${nextPrayer.time}`} /> : null}
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

function ClockScreen({ nextPrayer }: { nextPrayer: { label: string; time: string } | null }) {
  return (
    <Card className="m-clock-panel">
      <div className="display-datetime-pair">
        <AnalogClock className="display-analog-clock--mobile" />
        <div className="display-datetime-digital-col">
          <LiveClock className="display-datetime-digital display-datetime-digital--mobile" splitSeconds />
          {nextPrayer ? (
            <p className="display-datetime-next-prayer">
              <span className="display-datetime-next-prayer-label">התפילה הבאה:</span>
              <span className="display-datetime-next-prayer-detail">
                {nextPrayer.label}{" "}
                <span className="display-datetime-next-prayer-at">
                  ב־<span dir="ltr">{nextPrayer.time}</span>
                </span>
              </span>
            </p>
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
  highlightNow
}: {
  timeSections: DisplayTimeSection[];
  nowMinutes: number;
  highlightNow: boolean;
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
        return (
          <div key={`${row.dayOffset}-${row.kind}-${row.label}-${row.time}-${i}`} className="flex min-w-0 items-stretch">
            {i > 0 ? (
              <div
                className={cn("flex w-5 shrink-0 items-center justify-center", isNext ? "text-[#c9a24a]" : "text-[#d7c7a8]")}
                aria-hidden
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
              </div>
            ) : null}
            <div
              className={cn(
                "m-schedule-tile",
                isPrayer && "m-schedule-tile--prayer",
                isNext && "m-schedule-tile--next",
                isPast && !isNext && "m-schedule-tile--past"
              )}
            >
              {isNext ? <span className="m-tag m-tag--next">הבא</span> : null}
              {row.dayTag ? <span className="m-tag m-tag--day">{row.dayTag}</span> : null}
              <div className={cn("m-schedule-label", isNext && "pt-3")}>
                {isPrayer ? `תפילת ${row.label}` : row.label}
              </div>
              <div className="m-schedule-time">{row.time}</div>
            </div>
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
  zmanim = []
}: {
  prayerSchedule: DisplayPrayerSlot[];
  nowMinutes: number;
  highlightNow: boolean;
  zmanim?: Array<{ label: string; time: string }>;
}) {
  const rows = prayerSchedule
    .map((row) => ({ ...row, totalMinutes: toMinutes(row.time) }));

  if (!rows.length && !zmanim.length) {
    return <Card className="m-center m-muted">אין תפילות להיום.</Card>;
  }

  const nextTotalMinutes = highlightNow
    ? rows
        .filter((row) => row.totalMinutes >= nowMinutes)
        .sort((a, b) => a.totalMinutes - b.totalMinutes)[0]?.totalMinutes
    : undefined;

  const byGroup = new Map<PrayerGroupId, typeof rows>();
  for (const row of rows) {
    const group = prayerGroupIdFromLabel(row.label);
    const list = byGroup.get(group) ?? [];
    list.push(row);
    byGroup.set(group, list);
  }

  const groups = PRAYER_GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => {
    const groupRows = byGroup.get(group)!.sort((a, b) => a.totalMinutes - b.totalMinutes);
    return {
      group,
      title: prayerGroupTitle(group, groupRows),
      rows: groupRows
    };
  });

  return (
    <Card>
      <div className="space-y-2">
        {groups.map(({ group, title, rows: groupRows }) => (
          <div key={group} className="m-prayer-group">
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
          </div>
        ))}
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

function ShabbatScreen({ shabbat }: { shabbat: DisplayShabbat | null }) {
  if (!shabbat) {
    return <Card className="m-center m-muted">אין נתוני שבת להצגה כעת.</Card>;
  }
  const hasAgenda = Boolean(shabbat.agenda?.length);
  return (
    <div className="space-y-3">
      <div className="m-hero">
        <p className="m-hero-kicker">פרשת השבוע</p>
        <p className="m-hero-title">{shabbat.parasha}</p>
        {shabbat.mevarchimText ? <p className="m-hero-date">{shabbat.mevarchimText}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {shabbat.candleLighting ? <InfoTile label="הדלקת נרות" value={shabbat.candleLighting} /> : null}
        {shabbat.havdalah ? <InfoTile label="צאת השבת" value={shabbat.havdalah} /> : null}
      </div>
      {hasAgenda ? (
        <Card>
          <h3 className="m-section-title">סדר היום</h3>
          <div>
            {shabbat.agenda.map((row, i) => (
              <div key={`${row.content}-${i}`} className="m-time-row">
                <span>{row.content}</span>
                {row.itemTime ? <span className="m-time-row-time">{row.itemTime}</span> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : shabbat.prayers.length ? (
        <Card>
          <h3 className="m-section-title">זמני תפילות שבת</h3>
          <div>
            {shabbat.prayers.map((row, i) => (
              <TimeRow key={`${row.label}-${i}`} label={row.label} time={row.time} />
            ))}
          </div>
        </Card>
      ) : null}
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
