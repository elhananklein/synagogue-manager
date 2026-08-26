import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";
import { DEFAULT_SCHEDULE_ZMANIM_KEYS, sanitizeScheduleZmanimKeys } from "@/lib/zmanim-catalog";

type MinyanRow = {
  id: string;
  name: string;
  display_style: string;
  schedule_times_list?: string | null;
  schedule_zmanim_keys?: string[] | null;
  display_footer_text?: string | null;
};

/** UUID של Supabase — לא לבלבל עם מספר סידורי כמו "12" (אין מקפים). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s.trim());
}

function isOrdinalToken(s: string) {
  return /^\d+$/.test(s.trim());
}

export type DisplayStyle = "classic" | "modern" | "minimal" | "woodSilver" | "royalBlue";
export type ScreenKey =
  | "main"
  | "mainInfo"
  | "clock"
  | "halacha"
  | "dailyLearning"
  | "prayerTimes"
  | "shabbat"
  | "bulletin"
  | "fullSchedule";

export type HavdalahMode = "tzeit" | "minutes";

/**
 * מיקום ומנהג פר-בית-כנסת לחישוב זמנים.
 * כש-latitude/longitude ריקים — הקוד נופל חזרה לירושלים (תאימות לאחור).
 */
export type SynagogueZmanimLocation = {
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  timezone: string;
  candleLightingMinutes: number;
  havdalahMode: HavdalahMode;
  havdalahMinutes: number;
};

export const DEFAULT_ZMANIM_LOCATION: SynagogueZmanimLocation = {
  locality: null,
  latitude: null,
  longitude: null,
  elevation: null,
  timezone: "Asia/Jerusalem",
  candleLightingMinutes: 40,
  havdalahMode: "tzeit",
  havdalahMinutes: 72
};
export type PrayerType = "שחרית" | "מנחה" | "ערבית" | "מנחה ערב שבת" | "שחרית שבת" | "מנחה שבת" | "ערבית מוצ'ש";

export type PrayerSetting = {
  category: "weekday" | "shabbat";
  prayerType: PrayerType;
  daysOfWeek: number[];
  mode: "fixed" | "relative" | "parasha";
  fixedTime: string | null;
  zmanAnchor: string | null;
  offsetMinutes: number | null;
  roundMode: "none" | "up" | "down";
  /** מפתח פרשה כמו ב־Hebcal (עברית); רק כש־mode === "parasha" */
  parashaKey: string | null;
  /** יחסית לזמן יום: לקבע לפי יום ראשון לכל השבוע (מנחה/ערבית) */
  lockToSunday: boolean;
};

export type ScreenSetting = {
  screenKey: ScreenKey;
  sortOrder: number;
  durationSeconds: number;
  enabled: boolean;
};

export type ScheduleTimesListMode = "all" | "prayers_only";

export type DisplayConfig = {
  synagogueName: string;
  minyanId: string | null;
  minyanName: string | null;
  /** מיקום ומנהג לחישוב זמני היום וכניסת/יציאת שבת */
  location: SynagogueZmanimLocation;
  displayStyle: DisplayStyle;
  /** לוח זמנים במסך הראשי: כל הזמנים או רק תפילות */
  scheduleTimesListMode: ScheduleTimesListMode;
  /** אילו זמנים הלכתיים להציג בלוח המסך הראשי (מפתחות Hebcal, בסדר הקטלוג) */
  scheduleZmanimKeys: string[];
  /** הודעת גבאי בת שורה אחת המוצגת בתחתית כל המסכים, בכל הסגנונות */
  footerText: string | null;
  screens: ScreenSetting[];
  prayerSettings: PrayerSetting[];
};

const DEFAULT_CONFIG: DisplayConfig = {
  synagogueName: "בית כנסת",
  minyanId: null,
  minyanName: null,
  location: DEFAULT_ZMANIM_LOCATION,
  displayStyle: "classic",
  scheduleTimesListMode: "all",
  scheduleZmanimKeys: DEFAULT_SCHEDULE_ZMANIM_KEYS,
  footerText: null,
  screens: [{ screenKey: "main", sortOrder: 1, durationSeconds: 25, enabled: true }],
  prayerSettings: []
};

function normalizeScheduleTimesListMode(raw: string | null | undefined): ScheduleTimesListMode {
  return raw === "prayers_only" ? "prayers_only" : "all";
}

/**
 * בחירת מניין לתצוגה:
 * - UUID — כמו קודם (`minyanim.id`)
 * - מספר בלבד (1, 2, …) — סדר לפי `created_at` עולה (כמו ברשימת הגבאי)
 * - כל מחרוזת אחרת — התאמת שם מדויקת (אחרי trim)
 */
export async function getDisplayConfig(synagogueId?: string | null, minyanSelector?: string | null): Promise<DisplayConfig> {
  const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();
  if (!supabase || !synagogueId) return DEFAULT_CONFIG;

  const synagogueRes = await supabase
    .from("synagogues")
    .select(
      "id, name, locality, latitude, longitude, elevation, timezone, candle_lighting_minutes, havdalah_mode, havdalah_minutes"
    )
    .eq("id", synagogueId)
    .maybeSingle();
  if (synagogueRes.error || !synagogueRes.data) return DEFAULT_CONFIG;

  const syn = synagogueRes.data as {
    name: string;
    locality: string | null;
    latitude: number | null;
    longitude: number | null;
    elevation: number | null;
    timezone: string | null;
    candle_lighting_minutes: number | null;
    havdalah_mode: string | null;
    havdalah_minutes: number | null;
  };
  const location: SynagogueZmanimLocation = {
    locality: syn.locality ?? null,
    latitude: typeof syn.latitude === "number" ? syn.latitude : null,
    longitude: typeof syn.longitude === "number" ? syn.longitude : null,
    elevation: typeof syn.elevation === "number" ? syn.elevation : null,
    timezone: syn.timezone?.trim() || "Asia/Jerusalem",
    candleLightingMinutes:
      typeof syn.candle_lighting_minutes === "number" ? syn.candle_lighting_minutes : 40,
    havdalahMode: syn.havdalah_mode === "minutes" ? "minutes" : "tzeit",
    havdalahMinutes: typeof syn.havdalah_minutes === "number" ? syn.havdalah_minutes : 72
  };

  const token = minyanSelector?.trim() ?? "";

  let chosenMinyan: MinyanRow | null = null;

  if (!token) {
    const r = await supabase
      .from("minyanim")
      .select("id, name, display_style, schedule_times_list, schedule_zmanim_keys, display_footer_text")
      .eq("synagogue_id", synagogueId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!r.error && r.data) chosenMinyan = r.data as MinyanRow;
  } else if (isUuid(token)) {
    const r = await supabase
      .from("minyanim")
      .select("id, name, display_style, schedule_times_list, schedule_zmanim_keys, display_footer_text")
      .eq("id", token)
      .eq("synagogue_id", synagogueId)
      .eq("is_active", true)
      .maybeSingle();
    if (!r.error && r.data) chosenMinyan = r.data as MinyanRow;
  } else {
    const listRes = await supabase
      .from("minyanim")
      .select("id, name, display_style, schedule_times_list, schedule_zmanim_keys, display_footer_text")
      .eq("synagogue_id", synagogueId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    const rows = (listRes.data ?? []) as MinyanRow[];
    if (!listRes.error && rows.length) {
      if (isOrdinalToken(token)) {
        const n = Number.parseInt(token, 10);
        chosenMinyan =
          Number.isInteger(n) && n >= 1 && n <= rows.length ? (rows[n - 1] ?? null) : (rows[0] ?? null);
      } else {
        chosenMinyan = rows.find((r) => r.name.trim() === token) ?? null;
      }
    }
  }

  if (!chosenMinyan) {
    return {
      ...DEFAULT_CONFIG,
      synagogueName: syn.name,
      location
    };
  }
  const [screensRes, prayerResInitial] = await Promise.all([
    supabase
      .from("minyan_display_screens")
      .select("screen_key, sort_order, duration_seconds, enabled")
      .eq("minyan_id", chosenMinyan.id),
    supabase
      .from("minyan_prayers")
      .select(
        "category, prayer_type, days_of_week, mode, fixed_time, zman_anchor, offset_minutes, round_mode, sort_order, parasha_key, lock_to_sunday"
      )
      .eq("minyan_id", chosenMinyan.id)
  ]);
  let prayerRes = prayerResInitial;
  if (prayerRes.error && /lock_to_sunday/i.test(prayerRes.error.message ?? "")) {
    prayerRes = await supabase
      .from("minyan_prayers")
      .select(
        "category, prayer_type, days_of_week, mode, fixed_time, zman_anchor, offset_minutes, round_mode, sort_order, parasha_key"
      )
      .eq("minyan_id", chosenMinyan.id);
  }

  const screens: ScreenSetting[] =
    screensRes.error || !screensRes.data?.length
      ? DEFAULT_CONFIG.screens
      : screensRes.data
          .map((row) => ({
            screenKey: row.screen_key as ScreenKey,
            sortOrder: row.sort_order,
            durationSeconds: row.duration_seconds,
            enabled: row.enabled
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);

  const prayerSettings: PrayerSetting[] =
    prayerRes.error || !prayerRes.data?.length
      ? []
      : prayerRes.data
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((row) => ({
            category: row.category as "weekday" | "shabbat",
            prayerType: row.prayer_type as PrayerType,
            daysOfWeek: Array.isArray(row.days_of_week) ? row.days_of_week.map((d) => Number(d)) : [],
            mode: row.mode as "fixed" | "relative" | "parasha",
            fixedTime: row.fixed_time,
            zmanAnchor: row.zman_anchor,
            offsetMinutes: row.offset_minutes,
            roundMode: (row.round_mode as "none" | "up" | "down") ?? "none",
            parashaKey: typeof row.parasha_key === "string" && row.parasha_key.trim() ? row.parasha_key.trim() : null,
            lockToSunday: Boolean(row.lock_to_sunday)
          }));

  const footerText =
    typeof chosenMinyan.display_footer_text === "string" && chosenMinyan.display_footer_text.trim()
      ? chosenMinyan.display_footer_text.trim()
      : null;

  return {
    synagogueName: syn.name,
    minyanId: chosenMinyan.id,
    minyanName: chosenMinyan.name,
    location,
    displayStyle: (chosenMinyan.display_style as DisplayStyle) ?? "classic",
    scheduleTimesListMode: normalizeScheduleTimesListMode(chosenMinyan.schedule_times_list),
    scheduleZmanimKeys: sanitizeScheduleZmanimKeys(chosenMinyan.schedule_zmanim_keys) ?? DEFAULT_SCHEDULE_ZMANIM_KEYS,
    footerText,
    screens,
    prayerSettings
  };
}

