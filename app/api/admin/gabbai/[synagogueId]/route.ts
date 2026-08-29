import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAllBulletinItemsForAdmin, saveBulletinItems, type BulletinItemInput } from "@/lib/bulletin-board";
import { getShabbatAgendaItemsByMinyanIds, saveShabbatAgendaItems, type ShabbatAgendaItemInput } from "@/lib/shabbat-agenda";
import { getDisplaySnapshot, toIsoDateJerusalem } from "@/lib/hebcal";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { sanitizeScheduleZmanimKeys } from "@/lib/zmanim-catalog";
import { canManageSynagogue, getAdminContext } from "@/lib/auth";
import { sortPrayersForSave } from "@/lib/prayer-order";
import { getParashaPrayerCatalogByMinyanIds } from "@/lib/parasha-prayer-catalog-db";
import {
  isDisplayStyle,
  resolveDisplayPalette,
  type DisplayPalette,
  type DisplayStyle
} from "@/lib/display-theme";
import { resolveHaftarahMinhag } from "@/lib/haftarah-minhag";
import { resolveHalachaSourceKey, type HalachaSourceKey } from "@/lib/halacha-source";

/** בודק שלמשתמש המחובר יש הרשאה לנהל את בית הכנסת. מחזיר NextResponse בדחייה. */
async function requireSynagogueAccess(synagogueId: string): Promise<NextResponse | null> {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!canManageSynagogue(ctx, synagogueId))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  return null;
}

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
  lockToSunday?: boolean;
};

type ScreenInput = {
  screenKey:
    | "main"
    | "mainInfo"
    | "clock"
    | "halacha"
    | "dailyLearning"
    | "prayerTimes"
    | "shabbat"
    | "bulletin"
    | "fullSchedule";
  sortOrder: number;
  durationSeconds: number;
  enabled: boolean;
};

type MinyanInput = {
  id?: string;
  name: string;
  displayStyle: DisplayStyle;
  displayPalette?: DisplayPalette | string | null;
  haftarahMinhag?: string | null;
  /** לוח במסך הראשי: כל הזמנים או רק תפילות */
  scheduleTimesListMode: "all" | "prayers_only";
  /** אילו זמנים הלכתיים להציג בלוח המסך הראשי (מפתחות Hebcal) */
  scheduleZmanimKeys?: string[] | null;
  /** טקסט חופשי לכותרת תחתונה בתצוגה */
  footerText?: string | null;
  prayerSettings: PrayerSettingInput[];
  screens: ScreenInput[];
  shabbatAgendaItems?: ShabbatAgendaItemInput[];
};

type HalachaSettingsInput = {
  startDate: string;
  sourceKey: HalachaSourceKey;
  displayMode: "summary" | "full";
};

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId } = await context.params;
  const denied = await requireSynagogueAccess(synagogueId);
  if (denied) return denied;

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
    .select("id, name, display_style, display_palette, haftarah_minhag, is_active, schedule_times_list, schedule_zmanim_keys, display_footer_text")
    .eq("synagogue_id", synagogueId)
    .order("created_at", { ascending: true });
  const minyanIds = (minyanRes.data ?? []).map((m) => m.id);

  const [prayerRes, screensRes] = await Promise.all([
    minyanIds.length
      ? supabase
          .from("minyan_prayers")
          .select(
            "id, minyan_id, category, prayer_type, days_of_week, mode, fixed_time, zman_anchor, offset_minutes, round_mode, sort_order, parasha_key, lock_to_sunday"
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
    displayPalette: resolveDisplayPalette(
      isDisplayStyle(minyan.display_style) ? minyan.display_style : "classic",
      typeof (minyan as { display_palette?: string | null }).display_palette === "string"
        ? (minyan as { display_palette?: string | null }).display_palette
        : null
    ),
    isActive: minyan.is_active,
    scheduleTimesListMode:
      (minyan as { schedule_times_list?: string }).schedule_times_list === "prayers_only" ? "prayers_only" : "all",
    scheduleZmanimKeys: sanitizeScheduleZmanimKeys(
      (minyan as { schedule_zmanim_keys?: string[] | null }).schedule_zmanim_keys
    ),
    footerText: (minyan as { display_footer_text?: string | null }).display_footer_text ?? null,
    haftarahMinhag: resolveHaftarahMinhag(
      typeof (minyan as { haftarah_minhag?: string | null }).haftarah_minhag === "string"
        ? (minyan as { haftarah_minhag?: string | null }).haftarah_minhag
        : null
    ),
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
        parashaKey: typeof p.parasha_key === "string" && p.parasha_key.trim() ? p.parasha_key.trim() : null,
        lockToSunday: Boolean(p.lock_to_sunday)
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
    sourceKey: resolveHalachaSourceKey(halachaSettingsRes.data?.source_key),
    displayMode: (halachaSettingsRes.data?.display_mode as "summary" | "full") ?? "summary"
  };
  const bulletinItems = await getAllBulletinItemsForAdmin(synagogueId);
  const agendaByMinyan = await getShabbatAgendaItemsByMinyanIds(minyanIds);
  const catalogByMinyan = await getParashaPrayerCatalogByMinyanIds(minyanIds);
  const minyanimWithAgenda = mappedMinyanim.map((minyan) => ({
    ...minyan,
    shabbatAgendaItems: minyan.id ? (agendaByMinyan[minyan.id] ?? []) : [],
    parashaCatalog: minyan.id ? (catalogByMinyan[minyan.id] ?? []) : []
  }));
  let currentParasha: string | null = null;
  try {
    const snap = await getDisplaySnapshot(toIsoDateJerusalem(), { omitDailyLearning: true });
    currentParasha = snap.parasha && snap.parasha !== "לא נמצא" ? snap.parasha : null;
  } catch {
    currentParasha = null;
  }

  return NextResponse.json({
    ok: true,
    data: {
      synagogue: synagogueRes.data,
      minyanim: minyanimWithAgenda,
      halachaSettings,
      bulletinItems,
      currentParasha
    }
  });
}

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId } = await context.params;
  const denied = await requireSynagogueAccess(synagogueId);
  if (denied) return denied;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }

  const payload = (await request.json()) as {
    synagogueName: string;
    minyanim: MinyanInput[];
    halachaSettings?: HalachaSettingsInput;
    bulletinItems?: BulletinItemInput[];
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
        const usesCatalog =
          !p.parashaKey?.trim() && (p.prayerType === "מנחה" || p.prayerType === "ערבית");
        if (!usesCatalog && (!p.parashaKey?.trim() || !p.fixedTime?.trim())) {
          return NextResponse.json({ ok: false, error: "parasha_requires_key_and_time" }, { status: 400 });
        }
      }
    }

    if (minyanId) {
      const { error } = await supabase
        .from("minyanim")
        .update({
          name: minyan.name.trim(),
          display_style: isDisplayStyle(minyan.displayStyle) ? minyan.displayStyle : "classic",
          display_palette: resolveDisplayPalette(
            isDisplayStyle(minyan.displayStyle) ? minyan.displayStyle : "classic",
            minyan.displayPalette
          ),
          schedule_times_list: minyan.scheduleTimesListMode === "prayers_only" ? "prayers_only" : "all",
          schedule_zmanim_keys: sanitizeScheduleZmanimKeys(minyan.scheduleZmanimKeys),
          display_footer_text: minyan.footerText?.trim() ? minyan.footerText.trim() : null,
          haftarah_minhag: resolveHaftarahMinhag(minyan.haftarahMinhag),
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
          display_style: isDisplayStyle(minyan.displayStyle) ? minyan.displayStyle : "classic",
          display_palette: resolveDisplayPalette(
            isDisplayStyle(minyan.displayStyle) ? minyan.displayStyle : "classic",
            minyan.displayPalette
          ),
          schedule_times_list: minyan.scheduleTimesListMode === "prayers_only" ? "prayers_only" : "all",
          schedule_zmanim_keys: sanitizeScheduleZmanimKeys(minyan.scheduleZmanimKeys),
          display_footer_text: minyan.footerText?.trim() ? minyan.footerText.trim() : null,
          haftarah_minhag: resolveHaftarahMinhag(minyan.haftarahMinhag),
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
      const orderedPrayers = sortPrayersForSave(minyan.prayerSettings);
      const { error: insertPrayerError } = await supabase.from("minyan_prayers").insert(
        orderedPrayers.map((p, index) => ({
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
          lock_to_sunday:
            p.mode === "relative" &&
            p.category === "weekday" &&
            (p.prayerType === "מנחה" || p.prayerType === "ערבית") &&
            Boolean(p.lockToSunday),
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

    if (!minyanId) {
      return NextResponse.json({ ok: false, error: "minyan_id_missing" }, { status: 500 });
    }

    if (minyan.shabbatAgendaItems) {
      const agendaResult = await saveShabbatAgendaItems(minyanId, minyan.shabbatAgendaItems);
      if (!agendaResult.ok) {
        return NextResponse.json({ ok: false, error: agendaResult.error }, { status: 500 });
      }
    }
  }

  const { error: halachaSettingsError } = await supabase.from("synagogue_halacha_settings").upsert(
    {
      synagogue_id: synagogueId,
      start_date: halachaSettings.startDate,
      source_key: resolveHalachaSourceKey(halachaSettings.sourceKey),
      display_mode: halachaSettings.displayMode
    },
    { onConflict: "synagogue_id" }
  );
  if (halachaSettingsError) {
    return NextResponse.json({ ok: false, error: halachaSettingsError.message }, { status: 500 });
  }

  if (payload.bulletinItems) {
    const bulletinResult = await saveBulletinItems(synagogueId, payload.bulletinItems);
    if (!bulletinResult.ok) {
      return NextResponse.json({ ok: false, error: bulletinResult.error }, { status: 500 });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("synagogue_id", synagogueId, { path: "/", httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 180 });

  return NextResponse.json({ ok: true });
}

