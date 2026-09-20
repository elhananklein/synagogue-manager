import {
  applyFridayAgendaMinchaTime,
  buildPrayerScheduleForDay,
  settingsNeedSundayZmanim,
  type BuiltPrayerRow
} from "@/lib/build-prayer-schedule";
import type { PrayerSetting, PrayerType, SynagogueZmanimLocation } from "@/lib/display-config";
import { formatDistanceKm, formatMinutesUntil, haversineKm, walkingMinutesFromKm } from "@/lib/geo";
import { addDaysIsoDate, getDisplaySnapshot, toIsoDateJerusalem, type DisplaySnapshot } from "@/lib/hebcal";
import { readJerusalemClock } from "@/lib/jerusalem-clock";
import {
  DEFAULT_NEARBY_HOURS,
  DEFAULT_NEARBY_RADIUS_KM,
  type NearbyMinyanHit,
  type NearbyMinyanimResult
} from "@/lib/nearby-minyanim-shared";
import { getParashaPrayerCatalogByMinyanIds } from "@/lib/parasha-prayer-catalog-db";
import { isChagOnDate, isErevShabbatonDate, jsWeekdayFromIso } from "@/lib/sacred-occasion";
import { getShabbatAgendaItemsByMinyanIds, type ShabbatAgendaItem } from "@/lib/shabbat-agenda";
import { erevMinchaTimeFromShabbatAgenda } from "@/lib/shabbat-schedule-periods";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";

const MAX_SYNAGOGUES = 12;
const MAX_RADIUS_KM = 25;
const MAX_HOURS = 24;

export type NearbyMinyanimQuery = {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  hours?: number;
};

type SynagogueLoc = {
  id: string;
  name: string;
  locality: string | null;
  latitude: number;
  longitude: number;
  elevation: number | null;
  timezone: string;
};

type MinyanRow = {
  id: string;
  name: string;
  synagogue_id: string;
  created_at: string | null;
};

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeNearbyRadiusKm(raw: unknown): number {
  return clamp(Number(raw), 0.5, MAX_RADIUS_KM, DEFAULT_NEARBY_RADIUS_KM);
}

export function normalizeNearbyHours(raw: unknown): number {
  return clamp(Number(raw), 1, MAX_HOURS, DEFAULT_NEARBY_HOURS);
}

function roundCoord(value: number) {
  return value.toFixed(3);
}

function locationKey(lat: number, lng: number, iso: string) {
  return `${roundCoord(lat)},${roundCoord(lng)}:${iso}`;
}

function clockMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function nowMinutesJerusalem(now = new Date()) {
  const parts = readJerusalemClock(now);
  return parts.hour * 60 + parts.minute;
}

function toLocation(row: SynagogueLoc): SynagogueZmanimLocation {
  return {
    locality: row.locality,
    latitude: row.latitude,
    longitude: row.longitude,
    elevation: row.elevation,
    timezone: row.timezone || "Asia/Jerusalem",
    candleLightingMinutes: 40,
    havdalahMode: "tzeit",
    havdalahMinutes: 72
  };
}

function mapPrayerSetting(row: {
  category: string;
  prayer_type: string;
  days_of_week: unknown;
  mode: string;
  fixed_time: string | null;
  zman_anchor: string | null;
  offset_minutes: number | null;
  round_mode: string | null;
  parasha_key?: string | null;
  lock_to_sunday?: boolean | null;
}): PrayerSetting {
  return {
    category: row.category === "shabbat" ? "shabbat" : "weekday",
    prayerType: row.prayer_type as PrayerType,
    daysOfWeek: Array.isArray(row.days_of_week) ? row.days_of_week.map((day) => Number(day)) : [],
    mode: row.mode === "relative" || row.mode === "parasha" ? row.mode : "fixed",
    fixedTime: row.fixed_time,
    zmanAnchor: row.zman_anchor,
    offsetMinutes: row.offset_minutes,
    roundMode: row.round_mode === "up" || row.round_mode === "down" ? row.round_mode : "none",
    parashaKey: typeof row.parasha_key === "string" && row.parasha_key.trim() ? row.parasha_key.trim() : null,
    lockToSunday: Boolean(row.lock_to_sunday)
  };
}

function nextPrayerInWindow(
  todayRows: BuiltPrayerRow[],
  tomorrowRows: BuiltPrayerRow[],
  nowMinutes: number,
  horizonMinutes: number
): NearbyMinyanHit["nextPrayer"] | null {
  const candidates: Array<{ row: BuiltPrayerRow; dayOffset: 0 | 1; abs: number }> = [];
  for (const row of todayRows) {
    const minutes = clockMinutes(row.time);
    if (minutes == null) continue;
    candidates.push({ row, dayOffset: 0, abs: minutes });
  }
  for (const row of tomorrowRows) {
    const minutes = clockMinutes(row.time);
    if (minutes == null) continue;
    candidates.push({ row, dayOffset: 1, abs: minutes + 24 * 60 });
  }
  candidates.sort((a, b) => a.abs - b.abs || a.dayOffset - b.dayOffset);
  const hit = candidates.find((item) => item.abs >= nowMinutes && item.abs <= horizonMinutes);
  if (!hit) return null;
  const minutesUntil = hit.abs - nowMinutes;
  return {
    label: hit.row.label,
    time: hit.row.time.slice(0, 5),
    minutesUntil,
    dayOffset: hit.dayOffset,
    untilLabel: formatMinutesUntil(minutesUntil)
  };
}

function walkingLabel(km: number) {
  const minutes = walkingMinutesFromKm(km);
  if (minutes <= 1) return "פחות מדקת הליכה";
  return `כ־${minutes} דק׳ הליכה`;
}

export async function findNearbyMinyanim(query: NearbyMinyanimQuery): Promise<NearbyMinyanimResult> {
  const radiusKm = normalizeNearbyRadiusKm(query.radiusKm);
  const hours = normalizeNearbyHours(query.hours);
  const empty: NearbyMinyanimResult = {
    radiusKm,
    hours,
    synagoguesWithLocation: 0,
    synagoguesInRange: 0,
    items: []
  };

  const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();
  if (!supabase) return empty;

  const synRes = await supabase
    .from("synagogues")
    .select("id, name, locality, latitude, longitude, elevation, timezone")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (synRes.error || !synRes.data?.length) return empty;

  const located: Array<SynagogueLoc & { distanceKm: number }> = [];
  for (const row of synRes.data) {
    const latitude = typeof row.latitude === "number" ? row.latitude : Number(row.latitude);
    const longitude = typeof row.longitude === "number" ? row.longitude : Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    located.push({
      id: String(row.id),
      name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : String(row.id),
      locality: typeof row.locality === "string" && row.locality.trim() ? row.locality.trim() : null,
      latitude,
      longitude,
      elevation: typeof row.elevation === "number" ? row.elevation : null,
      timezone: typeof row.timezone === "string" && row.timezone.trim() ? row.timezone.trim() : "Asia/Jerusalem",
      distanceKm: haversineKm(query.latitude, query.longitude, latitude, longitude)
    });
  }

  const inRange = located
    .filter((item) => item.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_SYNAGOGUES);

  if (!inRange.length) {
    return { ...empty, synagoguesWithLocation: located.length };
  }

  const synagogueIds = inRange.map((item) => item.id);
  const minyanRes = await supabase
    .from("minyanim")
    .select("id, name, synagogue_id, created_at")
    .in("synagogue_id", synagogueIds)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const minyanim = (minyanRes.data ?? []) as MinyanRow[];
  if (minyanRes.error || !minyanim.length) {
    return { ...empty, synagoguesWithLocation: located.length, synagoguesInRange: inRange.length };
  }

  const minyanIndexById = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const minyan of minyanim) {
    const next = (counts.get(minyan.synagogue_id) ?? 0) + 1;
    counts.set(minyan.synagogue_id, next);
    minyanIndexById.set(minyan.id, next);
  }

  const minyanIds = minyanim.map((item) => item.id);
  const prayerRes = await supabase
    .from("minyan_prayers")
    .select(
      "minyan_id, category, prayer_type, days_of_week, mode, fixed_time, zman_anchor, offset_minutes, round_mode, sort_order, parasha_key, lock_to_sunday"
    )
    .in("minyan_id", minyanIds)
    .order("sort_order", { ascending: true });

  const settingsByMinyan = new Map<string, PrayerSetting[]>();
  for (const id of minyanIds) settingsByMinyan.set(id, []);
  for (const row of prayerRes.data ?? []) {
    const minyanId = typeof row.minyan_id === "string" ? row.minyan_id : "";
    const list = settingsByMinyan.get(minyanId);
    if (!list) continue;
    list.push(mapPrayerSetting(row));
  }

  const [catalogByMinyan, agendaByMinyan] = await Promise.all([
    getParashaPrayerCatalogByMinyanIds(minyanIds).catch(() => {
      const emptyCatalog: Record<string, never[]> = {};
      for (const id of minyanIds) emptyCatalog[id] = [];
      return emptyCatalog;
    }),
    getShabbatAgendaItemsByMinyanIds(minyanIds).catch(() => {
      const emptyAgenda: Record<string, ShabbatAgendaItem[]> = {};
      for (const id of minyanIds) emptyAgenda[id] = [];
      return emptyAgenda;
    })
  ]);

  const todayIso = toIsoDateJerusalem();
  const tomorrowIso = addDaysIsoDate(todayIso, 1);
  const todayJs = jsWeekdayFromIso(todayIso);
  const tomorrowJs = jsWeekdayFromIso(tomorrowIso);
  const todaySundayIso = addDaysIsoDate(todayIso, -todayJs);
  const tomorrowSundayIso = addDaysIsoDate(tomorrowIso, -tomorrowJs);
  const nowMinutes = nowMinutesJerusalem();
  const horizonMinutes = nowMinutes + hours * 60;
  const needsTomorrow = horizonMinutes > 24 * 60;
  const todayIsErev = isErevShabbatonDate(todayIso);
  const tomorrowIsErev = isErevShabbatonDate(tomorrowIso);
  const todayErevIsChag = isChagOnDate(tomorrowIso);
  const tomorrowErevIsChag = isChagOnDate(addDaysIsoDate(tomorrowIso, 1));

  const snapshotCache = new Map<string, Promise<DisplaySnapshot | null>>();
  const loadSnapshot = (row: SynagogueLoc, iso: string) => {
    const key = locationKey(row.latitude, row.longitude, iso);
    const existing = snapshotCache.get(key);
    if (existing) return existing;
    const pending = getDisplaySnapshot(iso, { omitDailyLearning: true, location: toLocation(row) }).catch(
      () => null
    );
    snapshotCache.set(key, pending);
    return pending;
  };

  const synagogueById = new Map(inRange.map((item) => [item.id, item]));
  const items: NearbyMinyanHit[] = [];

  for (const minyan of minyanim) {
    const synagogue = synagogueById.get(minyan.synagogue_id);
    if (!synagogue) continue;
    const settings = settingsByMinyan.get(minyan.id) ?? [];
    if (!settings.length) continue;

    const needSunday = settingsNeedSundayZmanim(settings);
    const [todaySnap, tomorrowSnap, todaySundaySnap, tomorrowSundaySnap] = await Promise.all([
      loadSnapshot(synagogue, todayIso),
      needsTomorrow ? loadSnapshot(synagogue, tomorrowIso) : Promise.resolve(null),
      needSunday && todaySundayIso !== todayIso ? loadSnapshot(synagogue, todaySundayIso) : Promise.resolve(null),
      needSunday && needsTomorrow && tomorrowSundayIso !== tomorrowIso && tomorrowSundayIso !== todayIso
        ? loadSnapshot(synagogue, tomorrowSundayIso)
        : Promise.resolve(null)
    ]);

    const publishedAgenda = ((agendaByMinyan[minyan.id] ?? []) as ShabbatAgendaItem[]).filter(
      (item) => item.published !== false && item.content.trim()
    );
    const fridayAgendaMincha = erevMinchaTimeFromShabbatAgenda(publishedAgenda);
    const catalog = catalogByMinyan[minyan.id] ?? [];

    const todayRows = applyFridayAgendaMinchaTime(
      buildPrayerScheduleForDay(
        settings,
        todaySnap?.zmanimSourceTimes ?? {},
        todayJs,
        todayJs === 6,
        todaySnap?.parashaCatalogKey ?? null,
        (todaySundaySnap ?? todaySnap)?.zmanimSourceTimes ?? {},
        catalog,
        { treatAsErev: todayIsErev, isChag: todayErevIsChag, isChagDay: isChagOnDate(todayIso) }
      ),
      todayIsErev,
      fridayAgendaMincha,
      todayErevIsChag
    );

    const tomorrowRows = needsTomorrow
      ? applyFridayAgendaMinchaTime(
          buildPrayerScheduleForDay(
            settings,
            tomorrowSnap?.zmanimSourceTimes ?? {},
            tomorrowJs,
            tomorrowJs === 6,
            tomorrowSnap?.parashaCatalogKey ?? null,
            (tomorrowSundaySnap ?? tomorrowSnap)?.zmanimSourceTimes ?? {},
            catalog,
            { treatAsErev: tomorrowIsErev, isChag: tomorrowErevIsChag, isChagDay: isChagOnDate(tomorrowIso) }
          ),
          tomorrowIsErev,
          fridayAgendaMincha,
          tomorrowErevIsChag
        )
      : [];

    const nextPrayer = nextPrayerInWindow(todayRows, tomorrowRows, nowMinutes, horizonMinutes);
    if (!nextPrayer) continue;

    items.push({
      synagogueId: synagogue.id,
      synagogueName: synagogue.name,
      locality: synagogue.locality,
      minyanName: typeof minyan.name === "string" && minyan.name.trim() ? minyan.name.trim() : "מניין",
      minyanIndex: minyanIndexById.get(minyan.id) ?? 1,
      distanceKm: synagogue.distanceKm,
      distanceLabel: formatDistanceKm(synagogue.distanceKm),
      walkingLabel: walkingLabel(synagogue.distanceKm),
      nextPrayer
    });
  }

  items.sort((a, b) => a.nextPrayer.minutesUntil - b.nextPrayer.minutesUntil || a.distanceKm - b.distanceKm);

  return {
    radiusKm,
    hours,
    synagoguesWithLocation: located.length,
    synagoguesInRange: inRange.length,
    items
  };
}
