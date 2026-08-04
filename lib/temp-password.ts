import { randomInt } from "crypto";

// ללא תווים מבלבלים (0/O, 1/l/I) כדי שיהיה קל להקריא/להקליד.
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const ALL = UPPER + LOWER + DIGITS;

/** מייצר סיסמה זמנית קריאה (ברירת מחדל 12 תווים) עם לפחות אות גדולה/קטנה וספרה. */
export function generateTempPassword(length = 12): string {
  const required = [
    UPPER[randomInt(UPPER.length)],
    LOWER[randomInt(LOWER.length)],
    DIGITS[randomInt(DIGITS.length)]
  ];
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () => ALL[randomInt(ALL.length)]);
  const chars = [...required, ...rest];
  // ערבוב (Fisher–Yates) כדי שהתווים המחויבים לא יהיו תמיד בהתחלה.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
