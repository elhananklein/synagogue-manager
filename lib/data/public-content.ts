import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";
import { getTodayIsoDate, todayPrayerSchedule, type PrayerSlot } from "@/lib/data/mock-content";
import { getSefariaHalachaYomit } from "@/lib/data/sefaria-halacha";
import {
  halachaSourceLabel,
  isLiveHalachaSource,
  resolveHalachaSourceKey,
  type HalachaSourceKey
} from "@/lib/halacha-source";
import { unstable_noStore as noStore } from "next/cache";

type DbPrayerRow = {
  id: string;
  schedule_date?: string;
  prayer_type: string;
  prayer_time: string;
  minyan_label: string | null;
  notes: string | null;
};

function getIsoDateUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * כשאין שורה ב־synagogue_halacha_settings (או אין synagogueId), לא משתמשים ב־"היום" כעוגן —
 * אז diffCalendarDays(היום, היום) תמיד 0 ולכן תמיד נבחר display_day 1.
 * עוגן יציב מאפשר למסך הציבורי / בית כנסת בלי הגדרות להתקדם יום־יום במחזור ההלכות.
 */
const PUBLIC_HALACHA_ANCHOR_ISO =
  (typeof process !== "undefined" && process.env.PUBLIC_HALACHA_CYCLE_ANCHOR?.trim()) || "2024-01-01";

/** הפרש ימים בין שני תאריכי YYYY-MM-DD כימי לוח (בלי היסט של חצות UTC). */
function diffCalendarDays(isoA: string, isoB: string) {
  const toUtcMidnight = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return NaN;
    return Date.UTC(y, m - 1, d);
  };
  const a = toUtcMidnight(isoA);
  const b = toUtcMidnight(isoB);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((a - b) / 86400000);
}

function pickDailyHalachaRow<T extends { display_day: unknown }>(rows: T[], targetDisplayDay: number): T | null {
  const sorted = [...rows].sort((a, b) => Number(a.display_day) - Number(b.display_day));
  if (!sorted.length) return null;
  const exact = sorted.find((r) => Number(r.display_day) === targetDisplayDay);
  if (exact) return exact;
  const latestNotAfter = [...sorted].reverse().find((r) => Number(r.display_day) <= targetDisplayDay);
  if (latestNotAfter) return latestNotAfter;
  const maxD = Number(sorted[sorted.length - 1].display_day);
  if (Number.isFinite(maxD) && maxD >= 1) {
    const wrapped = ((targetDisplayDay - 1) % maxD) + 1;
    const byWrap = sorted.find((r) => Number(r.display_day) === wrapped);
    if (byWrap) return byWrap;
  }
  return sorted[sorted.length - 1] ?? null;
}

const LIVE_CACHE_SOURCE_KEY: HalachaSourceKey = "sefaria_halacha_yomit";
const HALACHA_SELECT =
  "title, content, full_text, summary_text, display_day, source_key, chapter_number, section_number";

type HalachaRow = {
  title: string;
  content: string | null;
  full_text: string | null;
  summary_text: string | null;
  display_day: number;
  source_key: string;
  chapter_number: number | null;
  section_number: number | null;
};

type PublicHalacha = {
  title: string;
  text: string;
  source: string;
  chapterNumber?: number;
  sectionNumber?: number;
  segments?: string[];
};

function parseHalachaSegments(row: HalachaRow, fallbackText: string): string[] | undefined {
  const raw = row.full_text?.trim();
  if (raw?.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        const segments = parsed.map((item) => item.trim()).filter(Boolean);
        if (segments.length) return segments;
      }
    } catch {
      /* טקסט רגיל, לא JSON */
    }
  }
  return fallbackText ? [fallbackText] : undefined;
}

function isoToDayNumber(iso: string): number {
  return Number(iso.replaceAll("-", ""));
}

function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function rowToPublicHalacha(row: HalachaRow, displayMode: "summary" | "full"): PublicHalacha | null {
  const text =
    displayMode === "full"
      ? (row.full_text?.trim() || String(row.content ?? "").trim())
      : String(row.summary_text ?? row.content ?? "").trim();
  if (!text) return null;
  return {
    title: row.title,
    text,
    source: halachaSourceLabel(row.source_key),
    chapterNumber: row.chapter_number ?? undefined,
    sectionNumber: row.section_number ?? undefined,
    segments: parseHalachaSegments(row, text)
  };
}

function normalizeSynagogueIdParam(id: string | string[] | null | undefined): string | null {
  if (id == null) return null;
  const raw = Array.isArray(id) ? id[0] : id;
  const s = String(raw ?? "").trim();
  return s.length ? s : null;
}

export async function getPublicHomeData(
  synagogueId?: string | string[] | null,
  opts?: { todayIso?: string | null }
) {
  // Supabase reads should always be fresh on page refresh (avoid Route Cache).
  noStore();

  const effectiveSynagogueId = normalizeSynagogueIdParam(synagogueId ?? null);

  const todayJerusalem = (opts?.todayIso && /^\d{4}-\d{2}-\d{2}$/.test(opts.todayIso) ? opts.todayIso : null) ?? getTodayIsoDate();
  const now = new Date();
  const todayUtc = getIsoDateUtc(now);
  const yesterdayUtc = getIsoDateUtc(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const candidateDates = Array.from(new Set([todayJerusalem, todayUtc, yesterdayUtc]));
  /** אדמין עוקף RLS; בלי service role — anon (מדיניות public_read על daily_halacha וכו׳). */
  const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();

  if (!supabase) {
    return {
      schedule: todayPrayerSchedule,
      halacha: null
    };
  }

  const halachaSettingsQuery =
    effectiveSynagogueId
      ? supabase
          .from("synagogue_halacha_settings")
          .select("start_date, source_key, display_mode")
          .eq("synagogue_id", effectiveSynagogueId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

  const [prayerResult, halachaSettingsRes] = await Promise.all([
    supabase
      .from("prayer_schedules")
      .select("id, schedule_date, prayer_type, prayer_time, minyan_label, notes")
      .in("schedule_date", candidateDates)
      .eq("published", true)
      .order("schedule_date", { ascending: false })
      .order("prayer_time", { ascending: true }),
    halachaSettingsQuery
  ]);
  const configuredSourceKey = resolveHalachaSourceKey(halachaSettingsRes.data?.source_key);
  const displayMode = (halachaSettingsRes.data?.display_mode === "full" ? "full" : "summary") as
    | "summary"
    | "full";

  const schedule: PrayerSlot[] =
    prayerResult.error || !prayerResult.data?.length
      ? todayPrayerSchedule
      : (prayerResult.data as DbPrayerRow[]).map((row, index) => ({
          id: index + 1,
          prayerName: row.minyan_label ? `${row.prayer_type} (${row.minyan_label})` : row.prayer_type,
          time: row.prayer_time.slice(0, 5),
          notes: row.notes ?? undefined
        }));

  const dbHalacha =
    isLiveHalachaSource(configuredSourceKey)
      ? await resolveLiveHalacha(supabase, todayJerusalem)
      : await resolveTableHalacha(supabase, configuredSourceKey, displayMode, todayJerusalem, halachaSettingsRes.data?.start_date);

  return { schedule, halacha: dbHalacha };
}

async function loadPublishedHalachaRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  sourceKey: HalachaSourceKey
): Promise<HalachaRow[]> {
  const { data, error } = await supabase
    .from("daily_halacha")
    .select(HALACHA_SELECT)
    .eq("source_key", sourceKey)
    .eq("published", true)
    .order("display_day", { ascending: true });
  if (error || !data?.length) return [];
  return data as HalachaRow[];
}

async function persistLiveHalacha(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  todayIso: string,
  live: { title: string; text: string; segments: string[] }
) {
  const displayDay = isoToDayNumber(todayIso);
  const segments = live.segments.length ? live.segments : [live.text];
  await supabase.from("daily_halacha").upsert(
    {
      display_day: displayDay,
      title: live.title,
      content: segments[0] ?? live.text,
      full_text: JSON.stringify(segments),
      summary_text: segments[0] ?? live.text,
      source: "שולחן ערוך",
      source_key: LIVE_CACHE_SOURCE_KEY,
      published: true
    },
    { onConflict: "source_key,display_day" }
  );
}

async function loadLiveHalachaByDay(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  dayNumber: number
): Promise<PublicHalacha | null> {
  const { data, error } = await supabase
    .from("daily_halacha")
    .select(HALACHA_SELECT)
    .eq("source_key", LIVE_CACHE_SOURCE_KEY)
    .eq("display_day", dayNumber)
    .eq("published", true)
    .maybeSingle();
  if (error || !data) return null;
  return rowToPublicHalacha(data as HalachaRow, "full");
}

async function loadLatestLiveHalacha(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>
): Promise<PublicHalacha | null> {
  const { data, error } = await supabase
    .from("daily_halacha")
    .select(HALACHA_SELECT)
    .eq("source_key", LIVE_CACHE_SOURCE_KEY)
    .eq("published", true)
    .order("display_day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToPublicHalacha(data as HalachaRow, "full");
}

async function resolveTableHalacha(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  sourceKey: HalachaSourceKey,
  displayMode: "summary" | "full",
  todayJerusalem: string,
  startDateRaw: string | null | undefined
): Promise<PublicHalacha | null> {
  const rows = await loadPublishedHalachaRows(supabase, sourceKey);
  if (!rows.length) return null;
  const hasSettingsStart =
    typeof startDateRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDateRaw.slice(0, 10));
  const startDate = hasSettingsStart ? startDateRaw.slice(0, 10) : PUBLIC_HALACHA_ANCHOR_ISO;
  const daysFromStart = Math.max(0, diffCalendarDays(todayJerusalem, startDate));
  const targetDisplayDay = daysFromStart + 1;
  const chosen = pickDailyHalachaRow(rows, targetDisplayDay);
  return chosen ? rowToPublicHalacha(chosen, displayMode) : null;
}

/** חי → שמירה להיום → אתמול → האחרון שנשמר → מקור מקומי, כדי שהמסך לא יישאר ריק. */
async function resolveLiveHalacha(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  todayJerusalem: string
): Promise<PublicHalacha | null> {
  const live = await getSefariaHalachaYomit();
  if (live) {
    try {
      await persistLiveHalacha(supabase, todayJerusalem, live);
    } catch {
      /* התצוגה חשובה יותר מהשמירה */
    }
    return {
      title: live.title,
      text: live.text,
      source: halachaSourceLabel(LIVE_CACHE_SOURCE_KEY),
      segments: live.segments
    };
  }

  const todayCached = await loadLiveHalachaByDay(supabase, isoToDayNumber(todayJerusalem));
  if (todayCached) return todayCached;

  const yesterdayCached = await loadLiveHalachaByDay(supabase, isoToDayNumber(addDaysIso(todayJerusalem, -1)));
  if (yesterdayCached) return yesterdayCached;

  const latestLive = await loadLatestLiveHalacha(supabase);
  if (latestLive) return latestLive;

  const kitzur = await resolveTableHalacha(supabase, "kitzur_shulchan_arukh", "full", todayJerusalem, null);
  if (kitzur) return kitzur;
  return resolveTableHalacha(supabase, "manual", "full", todayJerusalem, null);
}
