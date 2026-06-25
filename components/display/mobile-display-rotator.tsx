"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, BookOpen, Clock, Sun, CalendarDays, ScrollText } from "lucide-react";
import { LiveClock } from "@/components/display/live-clock";
import { cn } from "@/lib/utils";
import type { DailyLearningLine } from "@/lib/hebcal";
import type {
  DisplayPrayerSlot,
  DisplayShabbat,
  DisplayTimeSection
} from "@/lib/build-display-view";

type ScreenKey = "main" | "mainInfo" | "clock" | "halacha" | "dailyLearning" | "prayerTimes" | "shabbat";

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
};

type MobileDisplayRotatorProps = {
  synagogueName: string;
  minyanName: string | null;
  footerText?: string | null;
  screens: RotatorScreen[];
  dailyLearning: DailyLearningLine[];
  snapshot: Snapshot;
  halacha: {
    title: string;
    text: string;
    source?: string;
    chapterNumber?: number;
    sectionNumber?: number;
  } | null;
  prayerSchedule: DisplayPrayerSlot[];
  timeSections: DisplayTimeSection[];
  shabbat?: DisplayShabbat | null;
};

const SCREEN_META: Record<ScreenKey, { title: string; Icon: typeof Sparkles }> = {
  main: { title: "מבט כללי", Icon: Sparkles },
  mainInfo: { title: "מידע מרכזי", Icon: Sparkles },
  clock: { title: "תאריך ושעה", Icon: Clock },
  halacha: { title: "הלכה יומית", Icon: ScrollText },
  dailyLearning: { title: "לימוד יומי", Icon: BookOpen },
  prayerTimes: { title: "זמני תפילות", Icon: CalendarDays },
  shabbat: { title: "שבת", Icon: Sun }
};

const PRAYER_GROUP_ORDER = ["שחרית", "מנחה", "ערבית", "אחר"] as const;
type PrayerGroupId = (typeof PRAYER_GROUP_ORDER)[number];

const PRAYER_GROUP_TITLES: Record<PrayerGroupId, string> = {
  שחרית: "שחרית",
  מנחה: "מנחה",
  ערבית: "ערבית",
  אחר: "נוספות"
};

const SWIPE_THRESHOLD = 48;
const SLIDE_MS = 320;

function prayerGroupIdFromLabel(label: string): PrayerGroupId {
  const t = label.trim();
  if (t.includes("שחרית")) return "שחרית";
  if (t.includes("מנחה")) return "מנחה";
  if (t.includes("ערבית")) return "ערבית";
  return "אחר";
}

function nowJerusalemMinutes() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  return now.getHours() * 60 + now.getMinutes();
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function MobileDisplayRotator({
  synagogueName,
  minyanName,
  footerText,
  screens,
  dailyLearning,
  snapshot,
  halacha,
  prayerSchedule,
  timeSections,
  shabbat = null
}: MobileDisplayRotatorProps) {
  const router = useRouter();
  const enabledScreens = useMemo(() => screens.filter((s) => s.enabled), [screens]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const dragAxisRef = useRef<"x" | "y" | null>(null);

  const screenCount = enabledScreens.length;
  const safeIndex = screenCount ? ((index % screenCount) + screenCount) % screenCount : 0;
  const current = enabledScreens[safeIndex];

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setViewportWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (index >= screenCount && screenCount > 0) setIndex(0);
  }, [index, screenCount]);

  const pauseInteraction = useCallback(() => setPaused(true), []);

  const goTo = useCallback(
    (i: number) => {
      if (!screenCount) return;
      setIndex(((i % screenCount) + screenCount) % screenCount);
      pauseInteraction();
    },
    [screenCount, pauseInteraction]
  );

  const next = useCallback(() => {
    if (!screenCount) return;
    setIndex((prev) => (prev + 1) % screenCount);
    pauseInteraction();
  }, [screenCount, pauseInteraction]);

  const prev = useCallback(() => {
    if (!screenCount) return;
    setIndex((prevIdx) => (prevIdx - 1 + screenCount) % screenCount);
    pauseInteraction();
  }, [screenCount, pauseInteraction]);

  useEffect(() => {
    if (!screenCount || paused || isDragging) return;
    const durationMs = Math.max(5, current?.durationSeconds ?? 20) * 1000;
    const timer = setTimeout(() => setIndex((prev) => (prev + 1) % screenCount), durationMs);
    return () => clearTimeout(timer);
  }, [screenCount, current, safeIndex, paused, isDragging]);

  useEffect(() => {
    const refreshIntervalMs = 5 * 60 * 1000;
    const intervalId = setInterval(() => router.refresh(), refreshIntervalMs);
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const midnightTimeoutId = setTimeout(() => router.refresh(), Math.max(1000, nextMidnight.getTime() - now.getTime()));
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
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

  const nowMinutes = nowJerusalemMinutes();
  const todayPrayers = (timeSections[0]?.items ?? [])
    .filter((item) => item.kind === "prayer")
    .map((item) => ({ ...item, totalMinutes: toMinutes(item.time) }))
    .sort((a, b) => a.totalMinutes - b.totalMinutes);
  const nextPrayer = todayPrayers.find((item) => item.totalMinutes >= nowMinutes) ?? null;

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    dragAxisRef.current = null;
    swipedRef.current = false;
    setIsDragging(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start || !viewportWidth) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (!dragAxisRef.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      dragAxisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (dragAxisRef.current !== "x") return;

    setIsDragging(true);
    const atFirst = safeIndex === 0;
    const atLast = safeIndex === screenCount - 1;
    let offset = dx;
    if ((atFirst && offset > 0) || (atLast && offset < 0)) offset *= 0.35;
    setDragOffset(offset);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    setIsDragging(false);
    setDragOffset(0);

    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (dragAxisRef.current !== "x" || Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) {
      dragAxisRef.current = null;
      return;
    }

    dragAxisRef.current = null;
    swipedRef.current = true;
    if (dx > 0) next();
    else prev();
  };

  const onAreaClick = () => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    next();
  };

  const slideFraction = screenCount > 0 ? 100 / screenCount : 100;
  const baseOffset = viewportWidth > 0 ? -safeIndex * viewportWidth : 0;
  const trackTransform =
    viewportWidth > 0
      ? `translate3d(${baseOffset + dragOffset}px, 0, 0)`
      : `translate3d(calc(-${safeIndex * slideFraction}% + ${dragOffset}px), 0, 0)`;

  const renderPanel = (screenKey: ScreenKey) => (
    <>
      <ScreenHeading screenKey={screenKey} />
      <div className="mt-4">
        {screenKey === "main" && <MainScreen snapshot={snapshot} timeSections={timeSections} />}
        {screenKey === "mainInfo" && <MainInfoScreen snapshot={snapshot} nextPrayer={nextPrayer} />}
        {screenKey === "clock" && <ClockScreen snapshot={snapshot} />}
        {screenKey === "halacha" && <HalachaScreen halacha={halacha} />}
        {screenKey === "dailyLearning" && <DailyLearningScreen lines={dailyLearning} />}
        {screenKey === "prayerTimes" && (
          <PrayerTimesScreen prayerSchedule={prayerSchedule} nowMinutes={nowMinutes} />
        )}
        {screenKey === "shabbat" && <ShabbatScreen shabbat={shabbat} />}
      </div>
    </>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight">{synagogueName}</h1>
            {minyanName ? <p className="truncate text-sm text-slate-500">{minyanName}</p> : null}
            <Link href="/?pick=1" className="text-xs text-emerald-600 underline-offset-2 hover:underline">
              החלפת בית כנסת
            </Link>
          </div>
          <div className="text-left">
            <LiveClock className="text-2xl font-bold tabular-nums tracking-tight" showSeconds={false} />
            <p className="text-xs text-slate-500">{snapshot.hebrewDate}</p>
          </div>
        </div>
        {nextPrayer ? (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            <span>התפילה הבאה: {nextPrayer.label}</span>
            <span className="tabular-nums">{nextPrayer.time}</span>
          </div>
        ) : null}
      </header>

      <div
        ref={viewportRef}
        dir="ltr"
        className="relative min-h-0 flex-1 overflow-hidden touch-pan-y"
        onClick={onAreaClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") next();
          else if (e.key === "ArrowRight") next();
          else if (e.key === "ArrowLeft") prev();
        }}
      >
        <div
          className={cn("flex h-full will-change-transform", !isDragging && "transition-transform ease-out")}
          style={{
            width: viewportWidth > 0 ? viewportWidth * screenCount : `${screenCount * 100}%`,
            transform: trackTransform,
            transitionDuration: isDragging ? "0ms" : `${SLIDE_MS}ms`
          }}
        >
          {enabledScreens.map((screen, i) => (
            <div
              key={`${screen.screenKey}-${i}`}
              dir="rtl"
              className="h-full shrink-0 grow-0 overflow-y-auto px-4 py-5"
              style={{
                width: viewportWidth > 0 ? viewportWidth : `${100 / Math.max(screenCount, 1)}%`
              }}
              aria-hidden={i !== safeIndex}
            >
              {renderPanel(screen.screenKey)}
            </div>
          ))}
        </div>
      </div>

      {screenCount > 1 ? (
        <div className="flex items-center justify-center gap-2 px-4 py-3">
          {enabledScreens.map((screen, i) => (
            <button
              key={`${screen.screenKey}-${i}`}
              type="button"
              aria-label={SCREEN_META[screen.screenKey].title}
              onClick={(e) => {
                e.stopPropagation();
                goTo(i);
              }}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === safeIndex ? "w-6 bg-emerald-600" : "w-2 bg-slate-300"
              )}
            />
          ))}
        </div>
      ) : null}

      {footerText ? (
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-sm text-slate-600">
          {footerText}
        </footer>
      ) : null}
    </div>
  );
}

function ScreenHeading({ screenKey }: { screenKey: ScreenKey }) {
  const { title, Icon } = SCREEN_META[screenKey];
  return (
    <div className="flex items-center gap-2 text-emerald-700">
      <Icon className="h-5 w-5" />
      <h2 className="text-base font-bold">{title}</h2>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-sm", className)}>{children}</div>;
}

function Badges({ snapshot }: { snapshot: Snapshot }) {
  const badges = [
    snapshot.parasha && snapshot.parasha !== "לא נמצא" ? `פרשת ${snapshot.parasha}` : null,
    snapshot.rainText,
    snapshot.blessingText,
    snapshot.omerText,
    snapshot.amidahAdditionText
  ].filter(Boolean) as string[];
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((text) => (
        <span key={text} className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          {text}
        </span>
      ))}
    </div>
  );
}

function TimeRow({ label, time, highlight }: { label: string; time: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2",
        highlight ? "bg-emerald-50 font-semibold text-emerald-700" : "odd:bg-slate-50"
      )}
    >
      <span className="text-[15px]">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums">{time}</span>
    </div>
  );
}

function MainScreen({ snapshot, timeSections }: { snapshot: Snapshot; timeSections: DisplayTimeSection[] }) {
  return (
    <div className="space-y-4">
      <Badges snapshot={snapshot} />
      {timeSections.map((section) => {
        if (!section.items.length) return null;
        const items = [...section.items].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
        return (
          <Card key={section.title}>
            <h3 className="mb-2 text-sm font-bold text-slate-500">{section.title}</h3>
            <div className="space-y-1">
              {items.map((item, i) => (
                <TimeRow key={`${item.label}-${i}`} label={item.label} time={item.time} />
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
    <Card className="text-center">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </Card>
  );
}

function MainInfoScreen({
  snapshot,
  nextPrayer
}: {
  snapshot: Snapshot;
  nextPrayer: { label: string; time: string } | null;
}) {
  return (
    <div className="space-y-3">
      <InfoTile label="תאריך עברי" value={snapshot.hebrewDate} />
      <div className="grid grid-cols-2 gap-3">
        {snapshot.parasha && snapshot.parasha !== "לא נמצא" ? (
          <InfoTile label="פרשת השבוע" value={snapshot.parasha} />
        ) : null}
        <InfoTile label="דף יומי" value={snapshot.dafYomi} />
        {nextPrayer ? <InfoTile label="התפילה הבאה" value={`${nextPrayer.label} ${nextPrayer.time}`} /> : null}
      </div>
      <Badges snapshot={snapshot} />
    </div>
  );
}

function ClockScreen({ snapshot }: { snapshot: Snapshot }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <LiveClock className="text-6xl font-black tabular-nums tracking-tight" showSeconds />
      <p className="text-xl font-bold">{snapshot.hebrewDate}</p>
      <p className="text-sm text-slate-500">{snapshot.gregorianDate}</p>
    </Card>
  );
}

function HalachaScreen({
  halacha
}: {
  halacha: { title: string; text: string; source?: string; chapterNumber?: number; sectionNumber?: number } | null;
}) {
  if (!halacha) {
    return <Card className="text-center text-slate-500">אין הלכה יומית להצגה כעת.</Card>;
  }
  return (
    <Card>
      <h3 className="mb-1 text-lg font-bold text-emerald-700">{halacha.title}</h3>
      {halacha.source ? <p className="mb-3 text-sm text-slate-500">{halacha.source}</p> : null}
      <p className="whitespace-pre-line text-[17px] leading-relaxed">{halacha.text}</p>
    </Card>
  );
}

function DailyLearningScreen({ lines }: { lines: DailyLearningLine[] }) {
  if (!lines.length) {
    return <Card className="text-center text-slate-500">אין לימוד יומי להצגה כעת.</Card>;
  }
  return (
    <div className="space-y-2">
      {lines.map((line) => (
        <Card key={line.id} className="flex items-center justify-between gap-3 py-3">
          <span className="font-semibold text-slate-600">{line.title}</span>
          <span className="text-left text-[15px] font-medium">{line.detail}</span>
        </Card>
      ))}
    </div>
  );
}

function PrayerTimesScreen({
  prayerSchedule,
  nowMinutes
}: {
  prayerSchedule: DisplayPrayerSlot[];
  nowMinutes: number;
}) {
  if (!prayerSchedule.length) {
    return <Card className="text-center text-slate-500">אין זמני תפילות מוגדרים.</Card>;
  }

  const rows = prayerSchedule.map((row) => ({ ...row, totalMinutes: toMinutes(row.time) }));
  const nextTotalMinutes = rows
    .map((row) => row.totalMinutes)
    .filter((m) => m >= nowMinutes)
    .sort((a, b) => a - b)[0];

  const byGroup = new Map<PrayerGroupId, typeof rows>();
  for (const row of rows) {
    const group = prayerGroupIdFromLabel(row.label);
    const list = byGroup.get(group) ?? [];
    list.push(row);
    byGroup.set(group, list);
  }

  const groups = PRAYER_GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => ({
    group,
    title: PRAYER_GROUP_TITLES[group],
    rows: byGroup.get(group)!.sort((a, b) => a.totalMinutes - b.totalMinutes)
  }));

  return (
    <Card className="p-3">
      <div className="space-y-2">
        {groups.map(({ group, title, rows: groupRows }) => (
          <div key={group} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <span className="w-14 shrink-0 text-sm font-bold text-slate-500">{title}</span>
            <div className="flex flex-1 flex-wrap justify-end gap-1.5">
              {groupRows.map((row, i) => {
                const isNext = row.totalMinutes === nextTotalMinutes;
                return (
                  <span
                    key={`${group}-${row.time}-${i}`}
                    className={cn(
                      "rounded-md px-2 py-1 text-[15px] font-semibold tabular-nums",
                      isNext ? "bg-emerald-600 text-white" : "bg-white text-slate-800 shadow-sm"
                    )}
                  >
                    {row.time}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ShabbatScreen({ shabbat }: { shabbat: DisplayShabbat | null }) {
  if (!shabbat) {
    return <Card className="text-center text-slate-500">אין נתוני שבת להצגה כעת.</Card>;
  }
  return (
    <div className="space-y-3">
      <Card className="text-center">
        <p className="text-sm text-slate-500">פרשת השבוע</p>
        <p className="mt-1 text-xl font-bold">{shabbat.parasha}</p>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {shabbat.candleLighting ? <InfoTile label="הדלקת נרות" value={shabbat.candleLighting} /> : null}
        {shabbat.havdalah ? <InfoTile label="צאת השבת" value={shabbat.havdalah} /> : null}
      </div>
      {shabbat.prayers.length ? (
        <Card>
          <h3 className="mb-2 text-sm font-bold text-slate-500">זמני תפילות שבת</h3>
          <div className="space-y-1">
            {shabbat.prayers.map((row, i) => (
              <TimeRow key={`${row.label}-${i}`} label={row.label} time={row.time} />
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
