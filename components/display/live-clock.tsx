"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function formatClock(now: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem"
  }).format(now);
}

export function LiveClock({ className }: { className?: string }) {
  // Keep server/client initial render identical to avoid hydration mismatch.
  const [timeText, setTimeText] = useState("--:--:--");

  useEffect(() => {
    setTimeText(formatClock(new Date()));

    const id = setInterval(() => {
      setTimeText(formatClock(new Date()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className={cn("display-clock-text", className)} suppressHydrationWarning>
      {timeText}
    </p>
  );
}

