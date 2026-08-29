"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useJerusalemClock } from "@/hooks/use-jerusalem-clock";
import { padClock } from "@/lib/jerusalem-clock";

function formatClockWithSeconds(now: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem"
  }).format(now);
}

function formatClockHoursMinutes(now: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem"
  }).format(now);
}

export function LiveClock({
  className,
  showSeconds = true,
  splitSeconds = false
}: {
  className?: string;
  /** כש־false — רק שעות ודקות (למשל כותרת Classic). */
  showSeconds?: boolean;
  /** שעות:דקות גדולות, שניות בפונט נפרד וקטן יותר. */
  splitSeconds?: boolean;
}) {
  const synced = useJerusalemClock();
  const [timeText, setTimeText] = useState(showSeconds ? "--:--:--" : "--:--");

  useEffect(() => {
    if (splitSeconds && showSeconds) return;
    const tick = () => {
      const now = new Date();
      setTimeText(showSeconds ? formatClockWithSeconds(now) : formatClockHoursMinutes(now));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [showSeconds, splitSeconds]);

  if (splitSeconds && showSeconds) {
    return (
      <p className={cn("display-clock-text", className)} suppressHydrationWarning>
        <span className="display-clock-hm">
          {padClock(synced.hour)}:{padClock(synced.minute)}
        </span>
        <span className="display-clock-seconds">:{padClock(synced.second)}</span>
      </p>
    );
  }

  return (
    <p className={cn("display-clock-text", className)} suppressHydrationWarning>
      {timeText}
    </p>
  );
}

