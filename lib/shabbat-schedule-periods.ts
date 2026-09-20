export type ShabbatPeriodId = "erev" | "morning" | "afternoon";

export type ShabbatScheduleRow = { label: string; time: string };

export type ShabbatPeriodColumn = {
  id: ShabbatPeriodId;
  title: string;
  rows: ShabbatScheduleRow[];
};

const PERIOD_DEFS: Array<{ id: ShabbatPeriodId; title: string; chagTitle: string }> = [
  { id: "erev", title: "ערב שבת", chagTitle: "ערב חג" },
  { id: "morning", title: "ביום השבת", chagTitle: "חג - בוקר" },
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
  if (/ערבית|מעריב/.test(text)) return "evening";
  return null;
}

/** שיוך שורה בודדת בלי הקשר סדר — לבדיקות. בלוח משתמשים ב־group לפי סדר הגבאי. */
export function shabbatPeriodFromRow(row: ShabbatScheduleRow): ShabbatPeriodId {
  const hint = labelHint(row.label);
  const band = clockBand(parseClockMinutes(row.time));
  if (hint === "motzaei") return "afternoon";
  if (hint === "erev") return "erev";
  if (hint === "morning" || band === "morning") return "morning";
  if (band === "evening" || hint === "evening") return "erev";
  if (hint === "afternoon" || band === "afternoon") return "afternoon";
  return "morning";
}

export type ShabbatPeriodTitleOptions = {
  weekdayChag?: boolean;
  /** כותרות ערב/בוקר של חג — גם כשחל בשבת */
  isChag?: boolean;
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
  const isChag = Boolean(options?.isChag ?? weekdayChag);
  if (id === "afternoon") {
    return shabbatAfternoonColumnTitle({
      isLastDay: options?.isLastDay,
      isSaturday: options?.isSaturday ?? !weekdayChag
    });
  }
  const def = PERIOD_DEFS.find((item) => item.id === id);
  if (!def) return "";
  return isChag ? def.chagTitle : def.title;
}

function assignPeriod(row: ShabbatScheduleRow, seenMorning: boolean, seenAfternoon: boolean): ShabbatPeriodId {
  const hint = labelHint(row.label);
  const band = clockBand(parseClockMinutes(row.time));

  if (hint === "motzaei") return "afternoon";
  if (hint === "erev") return "erev";
  if (hint === "morning" || band === "morning") return "morning";

  // מנחה/ערבית של ערב החג (אחרי כניסת החג, לפני שחרית) — לא עמודת מנחה של היום.
  if (!seenMorning) return "erev";

  if (hint === "afternoon" || band === "afternoon") return "afternoon";
  if (hint === "evening" || hint === "erev" || band === "evening") return "afternoon";
  return seenAfternoon ? "afternoon" : "morning";
}

export type AgendaMinchaSourceItem = {
  occasionDay?: number | null;
  itemTime: string | null;
  content: string;
};

/**
 * זמן מנחה של ערב שבת/חג מלוח השבת הידני — השורה הראשונה בעמודת ערב שמכילה «מנחה» ויש לה שעה.
 * מנחה של שבת אחה״צ (אחרי שחרית) לא נספרת.
 */
export function erevMinchaTimeFromShabbatAgenda(items: AgendaMinchaSourceItem[]): string | null {
  const withContent = items.filter((item) => item.content.trim());
  if (!withContent.length) return null;
  const hasDayField = withContent.some((item) => item.occasionDay != null);
  const day1 = hasDayField ? withContent.filter((item) => (item.occasionDay ?? 1) === 1) : withContent;
  const source = day1.length ? day1 : withContent;
  const rows = source.map((item) => ({
    label: item.content,
    time: item.itemTime?.trim() ?? ""
  }));
  const erev = groupShabbatScheduleByPeriod(rows).find((column) => column.id === "erev");
  const mincha = erev?.rows.find((row) => /מנחה/.test(normalizeLabel(row.label)) && parseClockMinutes(row.time) != null);
  const time = mincha?.time.trim().slice(0, 5) ?? "";
  return /^\d{2}:\d{2}$/.test(time) ? time : null;
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

  let seenMorning = false;
  let seenAfternoon = false;
  let previousPeriod: ShabbatPeriodId | null = null;
  for (const row of rows) {
    const period: ShabbatPeriodId =
      parseClockMinutes(row.time) == null && previousPeriod
        ? previousPeriod
        : assignPeriod(row, seenMorning, seenAfternoon);
    if (period === "morning") seenMorning = true;
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

export type AgendaDayForIso = {
  day: number;
  iso: string;
  weekdayChag?: boolean;
  isChag?: boolean;
  isSaturday?: boolean;
  isLastDay?: boolean;
  items: Array<{ itemTime: string | null; content: string }>;
};

function timedAgendaRows(items: AgendaDayForIso["items"]): ShabbatScheduleRow[] {
  return items
    .map((item) => ({
      label: item.content.trim(),
      time: item.itemTime?.trim().slice(0, 5) ?? ""
    }))
    .filter((row) => row.label && /^\d{1,2}:\d{2}$/.test(row.time))
    .map((row) => ({
      label: row.label,
      time: row.time.padStart(5, "0")
    }));
}

/**
 * שורות עם שעה מלוח שבת/חג שפורסם, לפי יום אזרחי:
 * ערב המועד — עמודת ערב בלבד; יום החג/שבת — בלי עמודת הערב.
 */
export function agendaTimedRowsForIso(days: AgendaDayForIso[], erevIso: string, iso: string): ShabbatScheduleRow[] {
  if (!days.length) return [];
  const withRows = days.map((day) => ({ ...day, rows: timedAgendaRows(day.items) }));
  const periodOptions = (day: AgendaDayForIso): ShabbatPeriodTitleOptions => ({
    weekdayChag: Boolean(day.weekdayChag),
    isChag: Boolean(day.isChag),
    isLastDay: Boolean(day.isLastDay),
    isSaturday: Boolean(day.isSaturday)
  });

  if (iso === erevIso) {
    const day1 = withRows.find((day) => day.day === 1) ?? withRows[0];
    if (!day1?.rows.length) return [];
    return groupShabbatScheduleByPeriod(day1.rows, periodOptions(day1)).find((column) => column.id === "erev")?.rows ?? [];
  }

  const day = withRows.find((item) => item.iso === iso);
  if (!day?.rows.length) return [];
  return groupShabbatScheduleByPeriod(day.rows, periodOptions(day))
    .filter((column) => column.id !== "erev")
    .flatMap((column) => column.rows);
}
