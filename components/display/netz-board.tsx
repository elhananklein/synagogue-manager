"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatHmTime } from "@/lib/hebcal";
import {
  formatNetzDuration,
  netzWindowBounds,
  previewNetzClock,
  previewNetzPlaceholder,
  resolveNetzClock,
  type NetzClock,
  type NetzPhase
} from "@/lib/netz-board";

/** בדיקה חוזרת לכל המאוחר כל 10 דקות — למקרה שהשעון קפץ או שהמכשיר נרדם. */
const NETZ_WINDOW_RECHECK_MS = 10 * 60 * 1000;

/** שעון שמתקדם כל שנייה. רק בתוך לוח הנץ עצמו, כדי לא לרנדר את כל המסך כל שנייה. */
function useNowMs() {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return nowMs;
}

/**
 * האם מסך הנץ נכנס לסבב. מתעדכן רק בגבולות החלון (טיימר לגבול הבא),
 * לא כל שנייה — המסך כולו לא מתרנדר בגלל זה.
 */
export function useNetzWindowOpen(
  previewPhase: NetzPhase | null,
  configured: boolean,
  sourceTimes: Record<string, string> | null | undefined
): boolean {
  const bounds = netzWindowBounds(sourceTimes);
  const startMs = bounds?.startMs ?? null;
  const endMs = bounds?.endMs ?? null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!configured || startMs == null || endMs == null) {
      setOpen(false);
      return;
    }
    let timer = 0;
    const check = () => {
      const now = Date.now();
      setOpen(now >= startMs && now < endMs);
      const nextBoundary = now < startMs ? startMs : now < endMs ? endMs : null;
      const delay =
        nextBoundary == null
          ? NETZ_WINDOW_RECHECK_MS
          : Math.min(NETZ_WINDOW_RECHECK_MS, Math.max(1000, nextBoundary - now));
      timer = window.setTimeout(check, delay);
    };
    check();
    return () => window.clearTimeout(timer);
  }, [configured, startMs, endMs]);

  return previewPhase != null || (configured && open);
}

/** שעון אמיתי לפי Hebcal, או תצוגה מקדימה כש־previewNetz בכתובת. */
function useDisplayedNetzClock(
  previewPhase: NetzPhase | null,
  sourceTimes: Record<string, string> | null | undefined
): NetzClock | null {
  const nowMs = useNowMs();
  const anchorRef = useRef<number | null>(null);
  if (!previewPhase) anchorRef.current = null;
  else if (nowMs != null && anchorRef.current == null) anchorRef.current = nowMs;

  if (previewPhase) {
    if (nowMs == null || anchorRef.current == null) return previewNetzPlaceholder(previewPhase);
    return previewNetzClock(previewPhase, nowMs, anchorRef.current);
  }
  return nowMs == null ? null : resolveNetzClock(nowMs, sourceTimes);
}

function NetzBody({ clock, variant }: { clock: NetzClock; variant: "wall" | "mobile" }) {
  const showTimes = Boolean(clock.alotIso && clock.sunriseIso);
  const alot = showTimes ? formatHmTime(clock.alotIso) : "";
  const sunrise = showTimes ? formatHmTime(clock.sunriseIso) : "";
  const status = clock.phase === "after" ? "הנץ היה לפני" : "עד הנץ החמה";
  const statusClass = variant === "wall" ? "display-netz-status" : "m-netz-status";
  const clockClass = variant === "wall" ? "display-netz-clock" : "m-netz-clock";
  const timesClass = variant === "wall" ? "display-netz-times" : "m-netz-times";

  return (
    <>
      <p className={statusClass}>{status}</p>
      <p className={clockClass} dir="ltr" suppressHydrationWarning>
        {formatNetzDuration(clock.clockMs)}
      </p>
      {showTimes ? (
        <p className={timesClass}>
          <span>
            עלות השחר <bdi dir="ltr">{alot}</bdi>
          </span>
          <span>
            הנץ החמה <bdi dir="ltr">{sunrise}</bdi>
          </span>
        </p>
      ) : null}
    </>
  );
}

export function NetzBoard({
  previewPhase,
  sourceTimes,
  variant,
  className
}: {
  previewPhase: NetzPhase | null;
  sourceTimes: Record<string, string> | null | undefined;
  variant: "wall" | "mobile";
  className?: string;
}) {
  const clock = useDisplayedNetzClock(previewPhase, sourceTimes);
  if (!clock) return null;

  if (variant === "mobile") {
    return (
      <Card className="m-clock-panel m-center m-netz">
        <NetzBody clock={clock} variant="mobile" />
      </Card>
    );
  }

  return (
    <section className={cn("display-clock-screen display-card display-netz-screen", className)}>
      <p className="display-netz-title">לוח הנץ</p>
      <NetzBody clock={clock} variant="wall" />
    </section>
  );
}
