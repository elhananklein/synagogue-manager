import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { getAdminContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** בודק שהמשתמש המחובר הוא מנהל-מערכת. מחזיר NextResponse במקרה של דחייה. */
async function requireSystemAdmin(): Promise<NextResponse | null> {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "system") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  return null;
}

const SELECT_COLUMNS =
  "id, name, created_at, locality, latitude, longitude, elevation, timezone, candle_lighting_minutes, havdalah_mode, havdalah_minutes";

type LocationSettings = {
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  timezone: string;
  candle_lighting_minutes: number;
  havdalah_mode: "tzeit" | "minutes";
  havdalah_minutes: number;
};

type RawSettingsBody = {
  locality?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  elevation?: unknown;
  timezone?: unknown;
  candle_lighting_minutes?: unknown;
  havdalah_mode?: unknown;
  havdalah_minutes?: unknown;
};

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** מנרמל ומוודא שדות מיקום/מנהג. מחזיר { settings } או { error }. */
function parseLocationSettings(body: RawSettingsBody): { settings: LocationSettings } | { error: string } {
  const latitude = toNumberOrNull(body.latitude);
  const longitude = toNumberOrNull(body.longitude);
  const elevationRaw = toNumberOrNull(body.elevation);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return { error: "invalid_coordinates" };
  if (latitude !== null && (latitude < -90 || latitude > 90)) return { error: "invalid_coordinates" };
  if (longitude !== null && (longitude < -180 || longitude > 180)) return { error: "invalid_coordinates" };
  // חובה שקו רוחב ואורך יגיעו יחד (או ששניהם ריקים)
  if ((latitude === null) !== (longitude === null)) return { error: "invalid_coordinates" };

  const elevation = elevationRaw === null ? null : Math.round(elevationRaw);
  if (elevation !== null && Number.isNaN(elevation)) return { error: "invalid_elevation" };

  const candleRaw = toNumberOrNull(body.candle_lighting_minutes);
  const candle = candleRaw === null ? 40 : Math.round(candleRaw);
  if (Number.isNaN(candle) || candle < 0 || candle > 120) return { error: "invalid_candle_minutes" };

  const havdalahMode = body.havdalah_mode === "minutes" ? "minutes" : "tzeit";
  const havdalahRaw = toNumberOrNull(body.havdalah_minutes);
  const havdalahMinutes = havdalahRaw === null ? 72 : Math.round(havdalahRaw);
  if (Number.isNaN(havdalahMinutes) || havdalahMinutes < 0 || havdalahMinutes > 120) {
    return { error: "invalid_havdalah_minutes" };
  }

  const locality =
    typeof body.locality === "string" && body.locality.trim() ? body.locality.trim() : null;
  const timezone =
    typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "Asia/Jerusalem";

  return {
    settings: {
      locality,
      latitude,
      longitude,
      elevation,
      timezone,
      candle_lighting_minutes: candle,
      havdalah_mode: havdalahMode,
      havdalah_minutes: havdalahMinutes
    }
  };
}

export async function GET() {
  const denied = await requireSystemAdmin();
  if (denied) return denied;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("synagogues")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const denied = await requireSystemAdmin();
  if (denied) return denied;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }

  const body = (await request.json()) as { id?: string; name?: string } & RawSettingsBody;
  const id = (body.id ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();

  if (!/^[a-z0-9-]{3,40}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
  }

  const parsed = parseLocationSettings(body);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const { error } = await supabase.from("synagogues").insert({ id, name, ...parsed.settings });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const denied = await requireSystemAdmin();
  if (denied) return denied;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }

  const body = (await request.json()) as { id?: string; name?: string } & RawSettingsBody;
  const id = (body.id ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  const parsed = parseLocationSettings(body);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const update: Record<string, unknown> = { ...parsed.settings };
  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
  }

  const { error, data } = await supabase.from("synagogues").update(update).eq("id", id).select("id");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
