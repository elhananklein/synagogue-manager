"use client";

import { useEffect, useState } from "react";
import { toIsoDateJerusalem } from "@/lib/hebcal";
import {
  MAIN_TIMES_YIELD_TO_SHABBAT_SCREEN,
  shouldHideMainPrayerTimes
} from "@/lib/main-times-on-shabbat";
import { jsWeekdayFromIso } from "@/lib/sacred-occasion";

/** מסתיר זמני תפילה בראשי כשמסך השבת פעיל; בשישי — רק מחצות. מפעיל מחדש בדיוק בחצות. */
export function useHideMainPrayerTimes(input: {
  shabbatScreenActive: boolean;
  viewIso: string | null | undefined;
  chatzotIso: string | null | undefined;
}): boolean {
  const [, setTick] = useState(0);
  const viewIso = input.viewIso?.trim() || toIsoDateJerusalem();
  const jerusalemTodayIso = toIsoDateJerusalem();
  const hide = shouldHideMainPrayerTimes({
    shabbatScreenActive: input.shabbatScreenActive,
    viewIso,
    jerusalemTodayIso,
    chatzotIso: input.chatzotIso
  });

  useEffect(() => {
    if (!MAIN_TIMES_YIELD_TO_SHABBAT_SCREEN) return;
    if (!input.shabbatScreenActive) return;
    if (jsWeekdayFromIso(viewIso) !== 5) return;
    if (viewIso !== toIsoDateJerusalem()) return;
    if (!input.chatzotIso) return;
    const chatzotMs = new Date(input.chatzotIso).getTime();
    if (Number.isNaN(chatzotMs)) return;
    const wait = chatzotMs - Date.now();
    if (wait <= 0) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), wait + 250);
    return () => window.clearTimeout(id);
  }, [input.shabbatScreenActive, viewIso, input.chatzotIso]);

  return hide;
}
