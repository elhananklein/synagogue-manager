import { jsWeekdayFromIso } from "@/lib/sacred-occasion";

/**
 * כשמסך השבת פעיל — עמודת הזמנים במסך הראשי מוסתרת (נשארים פרשה, תוספות, דף יומי).
 * בשישי בלבד הזמנים נשארים עד חצות היום.
 *
 * Rollback: שנו ל־false. הקבצים שמשתמשים בזה:
 * - hooks/use-hide-main-prayer-times.ts
 * - components/display/display-rotator.tsx  (מחלקה display-main-grid--info-only)
 * - components/display/mobile-display-rotator.tsx
 * - lib/hebcal.ts  (שדה chatzotIso ב־snapshot)
 * CSS חדש בלבד: .display-main-grid--info-only ב־globals.css ו־very-bold.css
 */
export const MAIN_TIMES_YIELD_TO_SHABBAT_SCREEN = true;

export function shouldHideMainPrayerTimes(input: {
  shabbatScreenActive: boolean;
  viewIso: string;
  jerusalemTodayIso: string;
  chatzotIso: string | null | undefined;
  nowMs?: number;
}): boolean {
  if (!MAIN_TIMES_YIELD_TO_SHABBAT_SCREEN) return false;
  if (!input.shabbatScreenActive) return false;
  if (jsWeekdayFromIso(input.viewIso) === 5) {
    if (input.viewIso !== input.jerusalemTodayIso) return false;
    if (!input.chatzotIso) return false;
    const chatzotMs = new Date(input.chatzotIso).getTime();
    if (Number.isNaN(chatzotMs)) return false;
    return (input.nowMs ?? Date.now()) >= chatzotMs;
  }
  return true;
}
