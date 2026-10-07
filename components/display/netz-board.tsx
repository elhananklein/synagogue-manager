"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatHmTime } from "@/lib/hebcal";
import {
  formatNetzDuration,
  previewNetzClock,
  previewNetzPlaceholder,
  resolveNetzClock,
  type NetzClock,
  type NetzPhase
} from "@/lib/netz-board";

/** שעון חי רק כשמסך הנץ מופעל אצל הגבאי — כדי לזהות כניסה ויציאה מהחלון. */
export function useNowMs(active: boolean) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active]);

  return active ? nowMs : null;
}

/** שעון אמיתי לפי Hebcal, או תצוגה מקדימה כש־previewNetz בכתובת. */
export function useDisplayedNetzClock(
  previewPhase: NetzPhase | null,
  configured: boolean,
  sourceTimes: Record<string, string> | null | undefined
): NetzClock | null {
  const nowMs = useNowMs(configured || previewPhase != null);
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
  clock,
  variant,
  className
}: {
  clock: NetzClock;
  variant: "wall" | "mobile";
  className?: string;
}) {
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
