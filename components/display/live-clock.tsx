"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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
  showSeconds = true
}: {
  className?: string;
  /** כש־false — רק שעות ודקות (למשל כותרת Classic). */
  showSeconds?: boolean;
}) {
  const placeholder = showSeconds ? "--:--:--" : "--:--";
  const [timeText, setTimeText] = useState(placeholder);

  useEffect(() => {
    const format = showSeconds ? formatClockWithSeconds : formatClockHoursMinutes;
    setTimeText(format(new Date()));
    const id = setInterval(() => setTimeText(format(new Date())), showSeconds ? 1000 : 1000);
    return () => clearInterval(id);
  }, [showSeconds]);

  return (
    <p className={cn("display-clock-text", className)} suppressHydrationWarning>
      {timeText}
    </p>
  );
}

