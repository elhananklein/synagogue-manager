const WEEKDAY_PRAYER_ORDER = ["סליחות", "שחרית", "מנחה", "ערבית"] as const;
const SHABBAT_PRAYER_ORDER = ["מנחה ערב שבת", "שחרית שבת", "מנחה שבת", "ערבית מוצ'ש"] as const;

export function prayerTypeSortRank(category: "weekday" | "shabbat", prayerType: string): number {
  const list = category === "weekday" ? WEEKDAY_PRAYER_ORDER : SHABBAT_PRAYER_ORDER;
  const index = (list as readonly string[]).indexOf(prayerType);
  return index === -1 ? 99 : index;
}

/** סדר שמירה: סליחות → שחרית → מנחה → ערבית (חול), ואז תפילות שבת לפי סדר היום. יציב בתוך אותו סוג. */
export function sortPrayersForSave<T extends { category: "weekday" | "shabbat"; prayerType: string }>(
  prayers: T[]
): T[] {
  const byType = (a: T, b: T) => prayerTypeSortRank(a.category, a.prayerType) - prayerTypeSortRank(b.category, b.prayerType);
  return [
    ...prayers.filter((p) => p.category === "weekday").sort(byType),
    ...prayers.filter((p) => p.category === "shabbat").sort(byType)
  ];
}
