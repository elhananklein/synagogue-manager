import { addDaysIsoDate } from "@/lib/hebcal";
import { normalizeClockTime } from "@/lib/parasha-prayer-catalog";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";
import { relativeDayLabel } from "@/lib/view-date";
import type {
  Lesson,
  LessonDisplayItem,
  LessonInput,
  LessonSeries,
  LessonSeriesInput,
  LessonsScreenBlock,
  LessonsScreenDay,
  LessonsScreenLesson
} from "@/lib/lessons-types";

export type {
  Lesson,
  LessonDisplayItem,
  LessonInput,
  LessonSeries,
  LessonSeriesInput,
  LessonsScreenBlock,
  LessonsScreenDay,
  LessonsScreenLesson
} from "@/lib/lessons-types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function trimOrNull(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t : null;
}

function jsWeekdayFromIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

function lessonTitle(topic: string | null | undefined): string {
  const t = topic?.trim();
  return t || "שיעור";
}

function joinDetails(parts: Array<string | null | undefined>): string {
  return parts.map((p) => (typeof p === "string" ? p.trim() : "")).filter(Boolean).join(" · ");
}

function mapSeriesRow(row: Record<string, unknown>): LessonSeries {
  return {
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    audience: typeof row.audience === "string" ? row.audience : null,
    price: typeof row.price === "string" ? row.price : null,
    displayAsGroup: Boolean(row.display_as_group),
    published: row.published !== false,
    sortOrder: Number(row.sort_order) || 0
  };
}

function mapLessonRow(row: Record<string, unknown>): Lesson {
  const weekdayRaw = row.weekday;
  const weekday =
    weekdayRaw == null || weekdayRaw === ""
      ? null
      : Number.isFinite(Number(weekdayRaw))
        ? Number(weekdayRaw)
        : null;
  const dateRaw = typeof row.lesson_date === "string" ? row.lesson_date.slice(0, 10) : null;
  return {
    id: String(row.id),
    seriesId: typeof row.series_id === "string" ? row.series_id : null,
    weekday: weekday != null && weekday >= 0 && weekday <= 6 ? weekday : null,
    lessonDate: dateRaw && ISO_DATE_RE.test(dateRaw) ? dateRaw : null,
    startTime: normalizeClockTime(row.start_time) ?? "00:00",
    topic: typeof row.topic === "string" ? row.topic : null,
    speaker: typeof row.speaker === "string" ? row.speaker : null,
    audience: typeof row.audience === "string" ? row.audience : null,
    price: typeof row.price === "string" ? row.price : null,
    published: row.published !== false,
    sortOrder: Number(row.sort_order) || 0
  };
}

export async function getLessonWorkspace(synagogueId: string): Promise<{
  series: LessonSeries[];
  lessons: Lesson[];
}> {
  const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();
  if (!supabase) return { series: [], lessons: [] };

  const [seriesRes, lessonsRes] = await Promise.all([
    supabase
      .from("synagogue_lesson_series")
      .select("id, name, audience, price, display_as_group, published, sort_order")
      .eq("synagogue_id", synagogueId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("synagogue_lessons")
      .select(
        "id, series_id, weekday, lesson_date, start_time, topic, speaker, audience, price, published, sort_order"
      )
      .eq("synagogue_id", synagogueId)
      .order("sort_order", { ascending: true })
  ]);

  if (seriesRes.error || lessonsRes.error) {
    return { series: [], lessons: [] };
  }

  return {
    series: (seriesRes.data ?? []).map((row) => mapSeriesRow(row as Record<string, unknown>)),
    lessons: (lessonsRes.data ?? []).map((row) => mapLessonRow(row as Record<string, unknown>))
  };
}

function validateSeries(rows: LessonSeriesInput[]): { ok: true; rows: LessonSeriesInput[] } | { ok: false; error: string } {
  const out: LessonSeriesInput[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const name = rows[i].name?.trim() ?? "";
    if (!name) return { ok: false, error: "lesson_series_requires_name" };
    out.push({
      id: rows[i].id,
      name,
      audience: trimOrNull(rows[i].audience),
      price: trimOrNull(rows[i].price),
      displayAsGroup: Boolean(rows[i].displayAsGroup),
      published: rows[i].published !== false,
      sortOrder: i + 1
    });
  }
  return { ok: true, rows: out };
}

function validateLessons(
  rows: LessonInput[],
  seriesIds: Set<string>
): { ok: true; rows: LessonInput[] } | { ok: false; error: string } {
  const out: LessonInput[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i];
    const startTime = normalizeClockTime(raw.startTime);
    if (!startTime) return { ok: false, error: "lesson_invalid_time" };

    const weekday =
      raw.weekday == null || raw.weekday === ("" as unknown)
        ? null
        : Number(raw.weekday);
    const lessonDate =
      typeof raw.lessonDate === "string" && ISO_DATE_RE.test(raw.lessonDate.slice(0, 10))
        ? raw.lessonDate.slice(0, 10)
        : null;
    const hasWeekday = weekday != null && Number.isFinite(weekday) && weekday >= 0 && weekday <= 6;
    const hasDate = Boolean(lessonDate);
    if (hasWeekday === hasDate) return { ok: false, error: "lesson_requires_weekday_xor_date" };

    const seriesId = typeof raw.seriesId === "string" && raw.seriesId.trim() ? raw.seriesId.trim() : null;
    if (seriesId && !seriesIds.has(seriesId)) return { ok: false, error: "lesson_unknown_series" };

    out.push({
      id: raw.id,
      seriesId,
      weekday: hasWeekday ? weekday : null,
      lessonDate: hasDate ? lessonDate : null,
      startTime,
      topic: trimOrNull(raw.topic),
      speaker: trimOrNull(raw.speaker),
      audience: seriesId ? null : trimOrNull(raw.audience),
      price: seriesId ? null : trimOrNull(raw.price),
      published: raw.published !== false,
      sortOrder: i + 1
    });
  }
  return { ok: true, rows: out };
}

export async function saveLessonWorkspace(
  synagogueId: string,
  payload: { series?: LessonSeriesInput[]; lessons?: LessonInput[] }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "missing_service_role_key" };

  const seriesCheck = validateSeries(payload.series ?? []);
  if (!seriesCheck.ok) return seriesCheck;

  // מזהי לקוח (UUID) יציבים מאפשרים שיוך שיעור↔מסגרת לפני שמירה.
  for (const row of seriesCheck.rows) {
    if (!row.id?.trim()) return { ok: false, error: "lesson_series_requires_id" };
  }

  const knownSeriesIds = new Set(seriesCheck.rows.map((row) => row.id!));
  const lessonsCheck = validateLessons(payload.lessons ?? [], knownSeriesIds);
  if (!lessonsCheck.ok) return lessonsCheck;
  for (const row of lessonsCheck.rows) {
    if (!row.id?.trim()) return { ok: false, error: "lesson_requires_id" };
  }

  const existingSeries = await supabase
    .from("synagogue_lesson_series")
    .select("id")
    .eq("synagogue_id", synagogueId);
  if (existingSeries.error) return { ok: false, error: existingSeries.error.message };

  const toDeleteSeries = (existingSeries.data ?? [])
    .map((row) => String(row.id))
    .filter((id) => !knownSeriesIds.has(id));
  if (toDeleteSeries.length) {
    const { error } = await supabase
      .from("synagogue_lesson_series")
      .delete()
      .eq("synagogue_id", synagogueId)
      .in("id", toDeleteSeries);
    if (error) return { ok: false, error: error.message };
  }

  for (const row of seriesCheck.rows) {
    const body = {
      id: row.id,
      synagogue_id: synagogueId,
      name: row.name,
      audience: row.audience,
      price: row.price,
      display_as_group: row.displayAsGroup,
      published: row.published,
      sort_order: row.sortOrder
    };
    const { error } = await supabase.from("synagogue_lesson_series").upsert(body, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
  }

  const keepLessonIds = new Set(lessonsCheck.rows.map((row) => row.id!));
  const existingLessons = await supabase
    .from("synagogue_lessons")
    .select("id")
    .eq("synagogue_id", synagogueId);
  if (existingLessons.error) return { ok: false, error: existingLessons.error.message };

  const toDeleteLessons = (existingLessons.data ?? [])
    .map((row) => String(row.id))
    .filter((id) => !keepLessonIds.has(id));
  if (toDeleteLessons.length) {
    const { error } = await supabase
      .from("synagogue_lessons")
      .delete()
      .eq("synagogue_id", synagogueId)
      .in("id", toDeleteLessons);
    if (error) return { ok: false, error: error.message };
  }

  for (const row of lessonsCheck.rows) {
    const body = {
      id: row.id,
      synagogue_id: synagogueId,
      series_id: row.seriesId,
      weekday: row.weekday,
      lesson_date: row.lessonDate,
      start_time: row.startTime,
      topic: row.topic,
      speaker: row.speaker,
      audience: row.audience,
      price: row.price,
      published: row.published,
      sort_order: row.sortOrder
    };
    const { error } = await supabase.from("synagogue_lessons").upsert(body, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

type LessonWithSeries = Lesson & {
  series: LessonSeries | null;
};

function lessonAppliesToIso(lesson: Lesson, iso: string, weekday: number): boolean {
  if (!lesson.published) return false;
  if (lesson.lessonDate) return lesson.lessonDate === iso;
  return lesson.weekday === weekday;
}

/**
 * פריטי שיעור לתאריך אזרחי (ירושלים) — כולל קיבוץ מסגרת «כאחד».
 */
export function buildLessonDisplayItemsForIso(
  series: LessonSeries[],
  lessons: Lesson[],
  iso: string
): LessonDisplayItem[] {
  if (!ISO_DATE_RE.test(iso)) return [];
  const weekday = jsWeekdayFromIso(iso);
  const seriesById = new Map(series.map((s) => [s.id, s]));

  const dayLessons: LessonWithSeries[] = lessons
    .filter((lesson) => lessonAppliesToIso(lesson, iso, weekday))
    .map((lesson) => {
      const linked = lesson.seriesId ? seriesById.get(lesson.seriesId) ?? null : null;
      const seriesOk = linked && linked.published ? linked : null;
      return { ...lesson, series: seriesOk };
    })
    // שיעור משויך למסגרת לא־מפורסמת — לא מוצג
    .filter((lesson) => !(lesson.seriesId && !lesson.series));

  const groupedIds = new Set<string>();
  const items: LessonDisplayItem[] = [];

  const groupable = new Map<string, LessonWithSeries[]>();
  for (const lesson of dayLessons) {
    if (lesson.series?.displayAsGroup) {
      const list = groupable.get(lesson.series.id) ?? [];
      list.push(lesson);
      groupable.set(lesson.series.id, list);
      groupedIds.add(lesson.id);
    }
  }

  for (const [seriesId, groupLessons] of groupable) {
    const s = seriesById.get(seriesId);
    if (!s) continue;
    const sorted = [...groupLessons].sort(
      (a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder
    );
    const first = sorted[0];
    const childLines = sorted.map((lesson) =>
      joinDetails([lesson.startTime, lessonTitle(lesson.topic), lesson.speaker])
    );
    items.push({
      id: `series:${seriesId}:${iso}`,
      time: first.startTime,
      label: s.name.trim() || "ערב לימוד",
      // מחיר לא מוצג בלוח זמנים / קוביות — רק במסך שיעורים (אם הופעל)
      details: joinDetails([s.audience, childLines.join(" | ")]),
      isSeriesGroup: true,
      seriesName: s.name
    });
  }

  for (const lesson of dayLessons) {
    if (groupedIds.has(lesson.id)) continue;
    const audience = lesson.series?.audience ?? lesson.audience;
    items.push({
      id: lesson.id,
      time: lesson.startTime,
      label: lessonTitle(lesson.topic),
      details: joinDetails([lesson.series?.name, lesson.speaker, audience]),
      isSeriesGroup: false,
      seriesName: lesson.series?.name ?? null
    });
  }

  return items.sort((a, b) => a.time.localeCompare(b.time) || a.label.localeCompare(b.label, "he"));
}

export async function getPublishedLessonDisplayItemsForIso(
  synagogueId: string | null | undefined,
  iso: string
): Promise<LessonDisplayItem[]> {
  if (!synagogueId?.trim()) return [];
  const workspace = await getLessonWorkspace(synagogueId);
  const publishedSeries = workspace.series.filter((s) => s.published);
  const publishedLessons = workspace.lessons.filter((l) => l.published);
  return buildLessonDisplayItemsForIso(publishedSeries, publishedLessons, iso);
}

/** לשורות לוח שבת: תוכן + שעה. */
export function lessonDisplayToAgendaRows(
  items: LessonDisplayItem[]
): Array<{ itemTime: string; content: string }> {
  return items.map((item) => ({
    itemTime: item.time,
    content: item.details ? `${item.label} — ${item.details}` : item.label
  }));
}

function parseHmToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * מסך שיעורים: הימים הקרובים (ברירת מחדל שבוע), בלי שיעורים שכבר עברו היום.
 * שיעורים באותה מסגרת באותו יום — בלוק אחד עם כותרת; אותה שעה — באותה רמה.
 */
export function buildUpcomingLessonsScreen(
  series: LessonSeries[],
  lessons: Lesson[],
  todayIso: string,
  options?: { horizonDays?: number; nowMinutes?: number | null; showPrice?: boolean }
): LessonsScreenDay[] {
  if (!ISO_DATE_RE.test(todayIso)) return [];
  const horizon = Math.max(1, options?.horizonDays ?? 7);
  const nowMinutes = options?.nowMinutes;
  const showPrice = Boolean(options?.showPrice);
  const publishedSeries = series.filter((s) => s.published);
  const publishedLessons = lessons.filter((l) => l.published);
  const seriesById = new Map(publishedSeries.map((s) => [s.id, s]));
  const days: LessonsScreenDay[] = [];

  for (let offset = 0; offset < horizon; offset += 1) {
    const iso = addDaysIsoDate(todayIso, offset);
    const weekday = jsWeekdayFromIso(iso);
    let dayLessons = publishedLessons
      .filter((lesson) => lessonAppliesToIso(lesson, iso, weekday))
      .filter((lesson) => {
        if (lesson.seriesId && !seriesById.has(lesson.seriesId)) return false;
        return true;
      });

    if (offset === 0 && nowMinutes != null && Number.isFinite(nowMinutes)) {
      dayLessons = dayLessons.filter((lesson) => parseHmToMinutes(lesson.startTime) >= nowMinutes);
    }
    if (!dayLessons.length) continue;

    dayLessons = [...dayLessons].sort(
      (a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder
    );

    const bySeries = new Map<string, Lesson[]>();
    const standalone: Lesson[] = [];
    for (const lesson of dayLessons) {
      if (lesson.seriesId && seriesById.has(lesson.seriesId)) {
        const list = bySeries.get(lesson.seriesId) ?? [];
        list.push(lesson);
        bySeries.set(lesson.seriesId, list);
      } else {
        standalone.push(lesson);
      }
    }

    const toCard = (lesson: Lesson): LessonsScreenLesson => {
      const linked = lesson.seriesId ? seriesById.get(lesson.seriesId) ?? null : null;
      return {
        id: `${lesson.id}:${iso}`,
        time: lesson.startTime,
        label: lessonTitle(lesson.topic),
        details: joinDetails([
          lesson.speaker,
          linked ? null : lesson.audience,
          showPrice && !linked ? lesson.price : null
        ])
      };
    };

    type Sortable = { sortTime: string; sortOrder: number; block: LessonsScreenBlock };
    const sortable: Sortable[] = [];

    for (const [seriesId, group] of bySeries) {
      const s = seriesById.get(seriesId);
      if (!s || !group.length) continue;
      const sorted = [...group].sort(
        (a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder
      );
      sortable.push({
        sortTime: sorted[0].startTime,
        sortOrder: sorted[0].sortOrder,
        block: {
          id: `series:${seriesId}:${iso}`,
          kind: "series",
          title: s.name.trim() || "ערב לימוד",
          subtitle: joinDetails([s.audience, showPrice ? s.price : null]),
          lessons: sorted.map(toCard)
        }
      });
    }

    // שיעורים עצמאיים באותה שעה — באותה רמה (בלוק אחד עם כמה קוביות)
    const standaloneByTime = new Map<string, Lesson[]>();
    for (const lesson of standalone) {
      const list = standaloneByTime.get(lesson.startTime) ?? [];
      list.push(lesson);
      standaloneByTime.set(lesson.startTime, list);
    }
    for (const [time, group] of standaloneByTime) {
      const sorted = [...group].sort((a, b) => a.sortOrder - b.sortOrder);
      sortable.push({
        sortTime: time,
        sortOrder: sorted[0].sortOrder,
        block: {
          id: `standalone:${time}:${iso}`,
          kind: "standalone",
          title: null,
          subtitle: null,
          lessons: sorted.map(toCard)
        }
      });
    }

    sortable.sort((a, b) => a.sortTime.localeCompare(b.sortTime) || a.sortOrder - b.sortOrder);

    days.push({
      iso,
      dayLabel: relativeDayLabel(iso, todayIso),
      blocks: sortable.map((row) => row.block)
    });
  }

  return days;
}
