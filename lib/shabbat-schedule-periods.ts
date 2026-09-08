export type ShabbatPeriodId = "erev" | "morning" | "afternoon";

export type ShabbatScheduleRow = { label: string; time: string };

export type ShabbatPeriodColumn = {
  id: ShabbatPeriodId;
  title: string;
  rows: ShabbatScheduleRow[];
};

const PERIOD_DEFS: Array<{ id: ShabbatPeriodId; title: string; chagTitle: string }> = [
  { id: "erev", title: "ערב שבת", chagTitle: "ערב החג" },
  { id: "morning", title: "ביום השבת", chagTitle: "ביום החג" },
  { id: "afternoon", title: "מנחה עד מוצ״ש", chagTitle: "מנחה עד מוצאי החג" }
];

const AFTERNOON_START = 12 * 60;
const EVENING_START = 17 * 60;

function parseClockMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function normalizeLabel(label: string) {
  return label.replace(/["״'׳]/g, "").trim();
}

type ClockBand = "morning" | "afternoon" | "evening";

function clockBand(minutes: number | null): ClockBand | null {
  if (minutes == null) return null;
  if (minutes < AFTERNOON_START) return "morning";
  if (minutes < EVENING_START) return "afternoon";
  return "evening";
}

type LabelHint = ShabbatPeriodId | "evening" | "motzaei";

function labelHint(label: string): LabelHint | null {
  const text = normalizeLabel(label);
  if (/מוצ|הבדלה/.test(text)) return "motzaei";
  if (/ערב\s*שבת|קבלת\s*שבת|אחות\s*קטנה|לכה\s*דודי|הדלקת/.test(text)) return "erev";
  if (/מנחה/.test(text) && /ערב/.test(text)) return "erev";
  if (/שחרית|מוסף|קרבנות|קריאת\s*התורה/.test(text)) return "morning";
  if (/מנחה/.test(text)) return "afternoon";
  if (/ערבית/.test(text)) return "evening";
  return null;
}

/** שיוך שורה בודדת בלי הקשר סדר — לבדיקות. בלוח משתמשים ב־group לפי סדר הגבאי. */
export function shabbatPeriodFromRow(row: ShabbatScheduleRow): ShabbatPeriodId {
  const hint = labelHint(row.label);
  if (hint === "motzaei") return "afternoon";
  if (hint === "erev" || hint === "morning" || hint === "afternoon") return hint;
  const band = clockBand(parseClockMinutes(row.time));
  if (band === "morning") return "morning";
  if (band === "afternoon") return "afternoon";
  if (band === "evening" || hint === "evening") return "erev";
  return "morning";
}

export type ShabbatPeriodTitleOptions = {
  weekdayChag?: boolean;
  isLastDay?: boolean;
  isSaturday?: boolean;
};

export function shabbatAfternoonColumnTitle(options?: { isLastDay?: boolean; isSaturday?: boolean }) {
  if (options?.isLastDay === false) return "מנחה עד סוף היום";
  if (options?.isSaturday === false) return "מנחה עד מוצאי החג";
  return "מנחה עד מוצ״ש";
}

function periodTitle(id: ShabbatPeriodId, options?: ShabbatPeriodTitleOptions) {
  const weekdayChag = Boolean(options?.weekdayChag);
  if (id === "afternoon") {
    return shabbatAfternoonColumnTitle({
      isLastDay: options?.isLastDay,
      isSaturday: options?.isSaturday ?? !weekdayChag
    });
  }
  const def = PERIOD_DEFS.find((item) => item.id === id);
  if (!def) return "";
  return weekdayChag ? def.chagTitle : def.title;
}

function assignPeriod(row: ShabbatScheduleRow, seenAfternoon: boolean): ShabbatPeriodId {
  const hint = labelHint(row.label);
  const band = clockBand(parseClockMinutes(row.time));

  if (hint === "motzaei") return "afternoon";
  if (hint === "morning" || band === "morning") return "morning";
  if (hint === "afternoon" || band === "afternoon") return "afternoon";

  const isEvening = hint === "evening" || hint === "erev" || band === "evening";
  if (isEvening) return seenAfternoon ? "afternoon" : "erev";

  return seenAfternoon ? "afternoon" : "morning";
}

export function groupShabbatScheduleByPeriod(
  rows: ShabbatScheduleRow[],
  options?: ShabbatPeriodTitleOptions
): ShabbatPeriodColumn[] {
  const titleOptions = options ?? {};
  const buckets: Record<ShabbatPeriodId, ShabbatScheduleRow[]> = {
    erev: [],
    morning: [],
    afternoon: []
  };

  let seenAfternoon = false;
  let previousPeriod: ShabbatPeriodId | null = null;
  for (const row of rows) {
    const period: ShabbatPeriodId =
      parseClockMinutes(row.time) == null && previousPeriod
        ? previousPeriod
        : assignPeriod(row, seenAfternoon);
    if (period === "afternoon") seenAfternoon = true;
    previousPeriod = period;
    buckets[period].push(row);
  }

  return PERIOD_DEFS.map((def) => ({
    id: def.id,
    title: periodTitle(def.id, titleOptions),
    rows: buckets[def.id]
  })).filter((column) => column.rows.length > 0);
}
