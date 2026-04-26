"use client";

import { useEffect, useState } from "react";

function formatClock(now: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem"
  }).format(now);
}

export function LiveClock() {
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
    <p className="text-5xl font-bold tracking-wide md:text-7xl" suppressHydrationWarning>
      {timeText}
    </p>
  );
}

