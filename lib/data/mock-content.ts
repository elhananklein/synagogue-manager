export type PrayerSlot = {
  id: number;
  prayerName: string;
  time: string;
  notes?: string;
};

export const todayPrayerSchedule: PrayerSlot[] = [
  { id: 1, prayerName: "שחרית ותיקין", time: "05:45" },
  { id: 2, prayerName: "שחרית מרכזית", time: "07:00" },
  { id: 3, prayerName: "מנחה", time: "18:25", notes: "20 דקות לפני שקיעה" },
  { id: 4, prayerName: "ערבית", time: "19:10" }
];

export const dailyHalacha = {
  title: "הלכה יומית - ברכות הנהנין",
  text: "לפני אכילת עוגה מברכים מזונות, ולאחריה - על המחיה, אם אכלו כשיעור. ראוי להקפיד לברך מתוך ישוב הדעת ובכוונה."
};

export function getTodayIsoDate() {
  // Keep "today" aligned with local synagogue timezone instead of UTC.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem"
  }).format(new Date());
}
