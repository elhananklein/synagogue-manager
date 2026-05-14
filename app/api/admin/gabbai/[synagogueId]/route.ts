import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

type PrayerSettingInput = {
  category: "weekday" | "shabbat";
  prayerType: "שחרית" | "מנחה" | "ערבית" | "מנחה ערב שבת" | "שחרית שבת" | "מנחה שבת" | "ערבית מוצ'ש";
  daysOfWeek: number[];
  mode: "fixed" | "relative" | "parasha";
  fixedTime: string | null;
  zmanAnchor: string | null;
  offsetMinutes: number | null;
  roundMode: "none" | "up" | "down";
  parashaKey?: string | null;
};

type ScreenInput = {
  screenKey: "main" | "clock" | "halacha" | "dailyLearning" | "prayerTimes";
  sortOrder: number;
  durationSeconds: number;
  enabled: boolean;
};

type MinyanInput = {
  id?: string;
  name: string;
  displayStyle: "classic" | "modern" | "minimal" | "woodSilver";
  /** לוח במסך הראשי: כל הזמנים או רק תפילות */
  scheduleTimesListMode: "all" | "prayers_only";
  prayerSettings: PrayerSettingInput[];
  screens: ScreenInput[];
};

type HalachaSettingsInput = {
  startDate: string;
  sourceKey: "manual" | "kitzur_shulchan_arukh";
  displayMode: "summary" | "full";
};

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId } = await context.params;
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }

  const synagogueRes = await supabase.from("synagogues").select("id, name").eq("id", synagogueId).maybeSingle();
  if (synagogueRes.error || !synagogueRes.data) {
    return NextResponse.json({ ok: false, error: "synagogue_not_found" }, { status: 404 });
  }

  const minyanRes = await supabase
    .from("minyanim")
    .select("id, name, display_style, is_active, schedule_times_list")
    .eq("synagogue_id", synagogueId)
    .order("created_at", { ascending: true });
  const minyanIds = (minyanRes.data ?? []).map((m) => m.id);

  const [prayerRes, screensRes] = await Promise.all([
    minyanIds.length
      ? supabase
          .from("minyan_prayers")
          .select(
            "id, minyan_id, category, prayer_type, days_of_week, mode, fixed_time, zman_anchor, offset_minutes, round_mode, sort_order, parasha_key"
          )
          .in("minyan_id", minyanIds)
      : Promise.resolve({ data: [], error: null }),
    minyanIds.length
      ? supabase
          .from("minyan_display_screens")
          .select("id, minyan_id, screen_key, sort_order, duration_seconds, enabled")
          .in("minyan_id", minyanIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  const halachaSettingsRes = await supabase
    .from("synagogue_halacha_settings")
    .select("start_date, source_key, display_mode")
    .eq("synagogue_id", synagogueId)
    .maybeSingle();

  if (minyanRes.error || prayerRes.error || screensRes.error || halachaSettingsRes.error) {
    return NextResponse.json({ ok: false, error: "failed_loading_settings" }, { status: 500 });
  }

  const mappedMinyanim = (minyanRes.data ?? []).map((minyan) => ({
    id: minyan.id,
    name: minyan.name,
    displayStyle: minyan.display_style,
    isActive: minyan.is_active,
    scheduleTimesListMode:
      (minyan as { schedule_times_list?: string }).schedule_times_list === "prayers_only" ? "prayers_only" : "all",
    prayerSettings: (prayerRes.data ?? [])
      .filter((p) => p.minyan_id === minyan.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((p) => ({
        category: p.category,
        prayerType: p.prayer_type,
        daysOfWeek: Array.isArray(p.days_of_week) ? p.days_of_week.map((d) => Number(d)) : [],
        mode: p.mode,
        fixedTime: p.fixed_time,
        zmanAnchor: p.zman_anchor,
        offsetMinutes: p.offset_minutes,
        roundMode: p.round_mode ?? "none",
        parashaKey: typeof p.parasha_key === "string" && p.parasha_key.trim() ? p.parasha_key.trim() : null
      })),
    screens: (screensRes.data ?? [])
      .filter((s) => s.minyan_id === minyan.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        screenKey: s.screen_key,
        sortOrder: s.sort_order,
        durationSeconds: s.duration_seconds,
        enabled: s.enabled
      }))
  }));
  const halachaSettings = {
    startDate: halachaSettingsRes.data?.start_date ?? new Date().toISOString().slice(0, 10),
    sourceKey: (halachaSettingsRes.data?.source_key as "manual" | "kitzur_shulchan_arukh") ?? "manual",
    displayMode: (halachaSettingsRes.data?.display_mode as "summary" | "full") ?? "summary"
  };

  return NextResponse.json({
    ok: true,
    data: {
      synagogue: synagogueRes.data,
      minyanim: mappedMinyanim,
      halachaSettings
    }
  });
}

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId } = await context.params;
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }

  const payload = (await request.json()) as {
    synagogueName: string;
    minyanim: MinyanInput[];
    halachaSettings?: HalachaSettingsInput;
  };

  const synagogueName = payload.synagogueName?.trim();
  if (!synagogueName) {
    return NextResponse.json({ ok: false, error: "missing_synagogue_name" }, { status: 400 });
  }

  const { error: synagogueUpdateError } = await supabase.from("synagogues").update({ name: synagogueName }).eq("id", synagogueId);
  if (synagogueUpdateError) {
    return NextResponse.json({ ok: false, error: synagogueUpdateError.message }, { status: 500 });
  }

  const incomingMinyanim = payload.minyanim ?? [];
  const halachaSettings = payload.halachaSettings ?? {
    startDate: new Date().toISOString().slice(0, 10),
    sourceKey: "manual",
    displayMode: "summary"
  };
  const existingMinyanRes = await supabase.from("minyanim").select("id").eq("synagogue_id", synagogueId);
  if (existingMinyanRes.error) {
    return NextResponse.json({ ok: false, error: existingMinyanRes.error.message }, { status: 500 });
  }

  const keepIds = new Set(incomingMinyanim.map((m) => m.id).filter(Boolean) as string[]);
  const deleteIds = (existingMinyanRes.data ?? []).map((row) => row.id).filter((id) => !keepIds.has(id));
  if (deleteIds.length) {
    const { error } = await supabase.from("minyanim").delete().in("id", deleteIds);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  for (const minyan of incomingMinyanim) {
    let minyanId = minyan.id;
    if (!minyan.name?.trim()) continue;

    for (const p of minyan.prayerSettings) {
      if (p.mode === "parasha") {
        if (p.category !== "weekday") {
          return NextResponse.json({ ok: false, error: "parasha_mode_weekday_only" }, { status: 400 });
        }
        if (!p.parashaKey?.trim() || !p.fixedTime?.trim()) {
          return NextResponse.json({ ok: false, error: "parasha_requires_key_and_time" }, { status: 400 });
        }
      }
    }

    if (minyanId) {
      const { error } = await supabase
        .from("minyanim")
        .update({
          name: minyan.name.trim(),
          display_style: minyan.displayStyle,
          schedule_times_list: minyan.scheduleTimesListMode === "prayers_only" ? "prayers_only" : "all",
          is_active: true
        })
        .eq("id", minyanId)
        .eq("synagogue_id", synagogueId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    } else {
      const { data, error } = await supabase
        .from("minyanim")
        .insert({
          synagogue_id: synagogueId,
          name: minyan.name.trim(),
          display_style: minyan.displayStyle,
          schedule_times_list: minyan.scheduleTimesListMode === "prayers_only" ? "prayers_only" : "all",
          is_active: true
        })
        .select("id")
        .single();
      if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "minyan_create_failed" }, { status: 500 });
      minyanId = data.id;
    }

    const { error: deletePrayerError } = await supabase.from("minyan_prayers").delete().eq("minyan_id", minyanId);
    if (deletePrayerError) return NextResponse.json({ ok: false, error: deletePrayerError.message }, { status: 500 });
    if (minyan.prayerSettings.length) {
      const { error: insertPrayerError } = await supabase.from("minyan_prayers").insert(
        minyan.prayerSettings.map((p, index) => ({
          minyan_id: minyanId,
          category: p.category,
          prayer_type: p.prayerType,
          days_of_week: p.category === "weekday" ? (p.daysOfWeek ?? []) : [],
          mode: p.mode,
          fixed_time: p.mode === "fixed" || p.mode === "parasha" ? p.fixedTime : null,
          zman_anchor: p.mode === "relative" ? p.zmanAnchor : null,
          offset_minutes: p.mode === "relative" ? p.offsetMinutes : null,
          round_mode: p.mode === "relative" ? (p.roundMode ?? "none") : "none",
          parasha_key: p.mode === "parasha" ? p.parashaKey?.trim() ?? null : null,
          sort_order: index + 1
        }))
      );
      if (insertPrayerError) return NextResponse.json({ ok: false, error: insertPrayerError.message }, { status: 500 });
    }

    const { error: deleteScreenError } = await supabase.from("minyan_display_screens").delete().eq("minyan_id", minyanId);
    if (deleteScreenError) return NextResponse.json({ ok: false, error: deleteScreenError.message }, { status: 500 });
    if (minyan.screens.length) {
      const { error: insertScreenError } = await supabase.from("minyan_display_screens").insert(
        minyan.screens.map((s) => ({
          minyan_id: minyanId,
          screen_key: s.screenKey,
          sort_order: s.sortOrder,
          duration_seconds: s.durationSeconds,
          enabled: s.enabled
        }))
      );
      if (insertScreenError) return NextResponse.json({ ok: false, error: insertScreenError.message }, { status: 500 });
    }
  }

  const { error: halachaSettingsError } = await supabase.from("synagogue_halacha_settings").upsert(
    {
      synagogue_id: synagogueId,
      start_date: halachaSettings.startDate,
      source_key: halachaSettings.sourceKey,
      display_mode: halachaSettings.displayMode
    },
    { onConflict: "synagogue_id" }
  );
  if (halachaSettingsError) {
    return NextResponse.json({ ok: false, error: halachaSettingsError.message }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set("synagogue_id", synagogueId, { path: "/", httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 180 });

  return NextResponse.json({ ok: true });
}

