import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type DisplayStyle = "classic" | "modern" | "minimal" | "woodSilver";
export type ScreenKey = "main" | "clock" | "halacha";
export type PrayerType = "שחרית" | "מנחה" | "ערבית" | "מנחה ערב שבת" | "שחרית שבת" | "מנחה שבת" | "ערבית מוצ\"ש";

export type PrayerSetting = {
  category: "weekday" | "shabbat";
  prayerType: PrayerType;
  daysOfWeek: number[];
  mode: "fixed" | "relative";
  fixedTime: string | null;
  zmanAnchor: string | null;
  offsetMinutes: number | null;
  roundMode: "none" | "up" | "down";
};

export type ScreenSetting = {
  screenKey: ScreenKey;
  sortOrder: number;
  durationSeconds: number;
  enabled: boolean;
};

export type DisplayConfig = {
  synagogueName: string;
  minyanName: string | null;
  displayStyle: DisplayStyle;
  screens: ScreenSetting[];
  prayerSettings: PrayerSetting[];
};

const DEFAULT_CONFIG: DisplayConfig = {
  synagogueName: "בית כנסת",
  minyanName: null,
  displayStyle: "classic",
  screens: [{ screenKey: "main", sortOrder: 1, durationSeconds: 25, enabled: true }],
  prayerSettings: []
};

export async function getDisplayConfig(synagogueId?: string | null, minyanId?: string | null): Promise<DisplayConfig> {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !synagogueId) return DEFAULT_CONFIG;

  const synagogueRes = await supabase.from("synagogues").select("id, name").eq("id", synagogueId).maybeSingle();
  if (synagogueRes.error || !synagogueRes.data) return DEFAULT_CONFIG;

  let minyanRes;
  if (minyanId) {
    minyanRes = await supabase
      .from("minyanim")
      .select("id, name, display_style")
      .eq("id", minyanId)
      .eq("synagogue_id", synagogueId)
      .eq("is_active", true)
      .maybeSingle();
  } else {
    minyanRes = await supabase
      .from("minyanim")
      .select("id, name, display_style")
      .eq("synagogue_id", synagogueId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
  }

  if (minyanRes.error || !minyanRes.data) {
    return {
      ...DEFAULT_CONFIG,
      synagogueName: synagogueRes.data.name
    };
  }

  const chosenMinyan = minyanRes.data;
  const [screensRes, prayerRes] = await Promise.all([
    supabase
      .from("minyan_display_screens")
      .select("screen_key, sort_order, duration_seconds, enabled")
      .eq("minyan_id", chosenMinyan.id),
    supabase
      .from("minyan_prayers")
      .select("category, prayer_type, days_of_week, mode, fixed_time, zman_anchor, offset_minutes, round_mode, sort_order")
      .eq("minyan_id", chosenMinyan.id)
  ]);

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
            mode: row.mode as "fixed" | "relative",
            fixedTime: row.fixed_time,
            zmanAnchor: row.zman_anchor,
            offsetMinutes: row.offset_minutes,
            roundMode: (row.round_mode as "none" | "up" | "down") ?? "none"
          }));

  return {
    synagogueName: synagogueRes.data.name,
    minyanName: chosenMinyan.name,
    displayStyle: (chosenMinyan.display_style as DisplayStyle) ?? "classic",
    screens,
    prayerSettings
  };
}

