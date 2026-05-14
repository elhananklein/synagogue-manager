import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";
import { getTodayIsoDate, todayPrayerSchedule, type PrayerSlot } from "@/lib/data/mock-content";
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
      halacha: {
        title: "הלכה יומית",
        text: "אין חיבור למסד נתונים ולכן לא ניתן להציג הלכה ממקור מוגדר.",
        source: "אין מקור זמין",
        chapterNumber: undefined,
        sectionNumber: undefined
      }
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
  const rawConfiguredSource = halachaSettingsRes.data?.source_key;
  const configuredSourceKey =
    typeof rawConfiguredSource === "string" && rawConfiguredSource.trim().length > 0
      ? rawConfiguredSource.trim()
      : "kitzur_shulchan_arukh";
  /** טופס האדמין שומר ברירת מחדל `manual`; ההגדרות לרוב `kitzur_shulchan_arukh` — מנסים לפי סדר. */
  const halachaSourceKeysToTry = [...new Set([configuredSourceKey, "kitzur_shulchan_arukh", "manual"])];
  const halachaSelect =
    "title, content, full_text, summary_text, display_day, source_key, chapter_number, section_number";

  const [firstSourceKey, ...restSourceKeys] = halachaSourceKeysToTry;
  let halachaResult = await supabase
    .from("daily_halacha")
    .select(halachaSelect)
    .eq("source_key", firstSourceKey)
    .eq("published", true)
    .order("display_day", { ascending: true });

  for (const sourceKey of restSourceKeys) {
    if (!halachaResult.error && halachaResult.data && halachaResult.data.length > 0) break;
    halachaResult = await supabase
      .from("daily_halacha")
      .select(halachaSelect)
      .eq("source_key", sourceKey)
      .eq("published", true)
      .order("display_day", { ascending: true });
  }

  const schedule: PrayerSlot[] =
    prayerResult.error || !prayerResult.data?.length
      ? todayPrayerSchedule
      : (prayerResult.data as DbPrayerRow[]).map((row, index) => ({
          id: index + 1,
          prayerName: row.minyan_label ? `${row.prayer_type} (${row.minyan_label})` : row.prayer_type,
          time: row.prayer_time.slice(0, 5),
          notes: row.notes ?? undefined
        }));

  const dbHalacha = await (async () => {
    if (halachaResult.error || !halachaResult.data?.length) return null;
    const startDateRaw = halachaSettingsRes.data?.start_date;
    const hasSettingsStart =
      typeof startDateRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDateRaw.slice(0, 10));
    const startDate = hasSettingsStart ? startDateRaw.slice(0, 10) : PUBLIC_HALACHA_ANCHOR_ISO;
    const displayMode = halachaSettingsRes.data?.display_mode ?? "summary";
    const daysFromStart = Math.max(0, diffCalendarDays(todayJerusalem, startDate));
    const targetDisplayDay = daysFromStart + 1;
    const chosen = pickDailyHalachaRow(halachaResult.data, targetDisplayDay);
    if (!chosen) return null;
    const text =
      displayMode === "full"
        ? (chosen.full_text?.trim() || "אין טקסט מלא זמין להלכה זו.")
        : (chosen.summary_text ?? chosen.content);
    const rowSourceKey = String(chosen.source_key ?? "").trim() || configuredSourceKey;
    const sourceLabel =
      rowSourceKey === "kitzur_shulchan_arukh"
        ? "קיצור שולחן ערוך"
        : rowSourceKey === "manual"
          ? "מקור בסיס"
          : "מקור פנימי";
    return {
      title: chosen.title,
      text,
      source: sourceLabel,
      chapterNumber: chosen.chapter_number ?? undefined,
      sectionNumber: chosen.section_number ?? undefined
    };
  })();

  const halacha = dbHalacha ?? {
    title: "הלכה יומית",
    text: "לא נמצאה הלכה זמינה למקור וליום שהוגדרו. יש למשוך הלכות למקור הנבחר.",
    source: "אין הלכה זמינה",
    chapterNumber: undefined,
    sectionNumber: undefined
  };

  return { schedule, halacha };
}
