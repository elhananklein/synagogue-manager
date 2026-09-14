/** קבוצות תצוגה לקיר/מובייל: סליחות תמיד שורה ראשונה, גם אם השעה אחרי שחרית. */

export const PRAYER_DISPLAY_GROUP_ORDER = ["סליחות", "שחרית", "מנחה", "ערבית", "אחר"] as const;
export type PrayerDisplayGroupId = (typeof PRAYER_DISPLAY_GROUP_ORDER)[number];

export const PRAYER_DISPLAY_GROUP_TITLES: Record<PrayerDisplayGroupId, string> = {
  סליחות: "סליחות",
  שחרית: "שחרית",
  מנחה: "מנחה",
  ערבית: "ערבית",
  אחר: "נוספות"
};

function normalizePrayerText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/['׳’`"״]/g, "")
    .trim();
}

function clockMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function matchesGroup(text: string, needle: string) {
  return text.includes(needle);
}

export function prayerDisplayGroupId(row: { label: string; prayerType?: string | null }): PrayerDisplayGroupId {
  const type = normalizePrayerText(row.prayerType ?? "");
  const label = normalizePrayerText(row.label ?? "");
  const haystack = `${type} ${label}`.trim();
  if (matchesGroup(haystack, "סליחות") || matchesGroup(haystack, "סליחה") || haystack.toLowerCase().includes("selichot")) {
    return "סליחות";
  }
  if (matchesGroup(haystack, "שחרית")) return "שחרית";
  if (matchesGroup(haystack, "מנחה")) return "מנחה";
  if (matchesGroup(haystack, "ערבית")) return "ערבית";
  return "אחר";
}

export function prayerDisplayGroupTitle(group: PrayerDisplayGroupId, rows: Array<{ label: string }>): string {
  if (group === "מנחה" && rows.length > 0 && rows.every((row) => /ערב שבת|ערב חג/.test(row.label))) {
    return rows[0]!.label;
  }
  return PRAYER_DISPLAY_GROUP_TITLES[group];
}

export type GroupedPrayerRow<T> = T & { totalMinutes: number; group: PrayerDisplayGroupId };

export function groupPrayersForDisplay<T extends { label: string; time: string; prayerType?: string | null }>(
  rows: T[]
): Array<{ group: PrayerDisplayGroupId; title: string; rows: Array<GroupedPrayerRow<T>> }> {
  const prepared: Array<GroupedPrayerRow<T>> = rows.map((row) => ({
    ...row,
    totalMinutes: clockMinutes(row.time),
    group: prayerDisplayGroupId(row)
  }));
  prepared.sort((a, b) => a.totalMinutes - b.totalMinutes);
  const byGroup = new Map<PrayerDisplayGroupId, Array<GroupedPrayerRow<T>>>();
  for (const row of prepared) {
    const list = byGroup.get(row.group) ?? [];
    list.push(row);
    byGroup.set(row.group, list);
  }
  return PRAYER_DISPLAY_GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => {
    const groupRows = byGroup.get(group)!;
    return {
      group,
      title: prayerDisplayGroupTitle(group, groupRows),
      rows: groupRows
    };
  });
}

/** מנחה של חול ליום צום — בלי מנחה ערב שבת/חג ומנחה שבת. */
export function weekdayMinchaClockTimes(
  rows: Array<{ label: string; time: string; prayerType?: string | null }>
): string[] {
  const times: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (prayerDisplayGroupId(row) !== "מנחה") continue;
    const haystack = `${row.label} ${row.prayerType ?? ""}`;
    if (/ערב שבת|ערב חג|מנחה שבת/.test(haystack)) continue;
    const time = row.time.trim();
    if (!time || seen.has(time)) continue;
    seen.add(time);
    times.push(time);
  }
  return times;
}
