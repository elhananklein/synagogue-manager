import { NextResponse } from "next/server";

import {
  findNearbyMinyanim,
  normalizeNearbyHours,
  normalizeNearbyRadiusKm
} from "@/lib/nearby-minyanim";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseCoord(raw: string | null, min: number, max: number): number | null {
  if (raw == null || !raw.trim()) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseCoord(searchParams.get("lat"), -90, 90);
    const longitude = parseCoord(searchParams.get("lng"), -180, 180);
    if (latitude == null || longitude == null) {
      return NextResponse.json({ ok: false, error: "invalid_location" }, { status: 400 });
    }

    const result = await findNearbyMinyanim({
      latitude,
      longitude,
      radiusKm: normalizeNearbyRadiusKm(searchParams.get("radiusKm")),
      hours: normalizeNearbyHours(searchParams.get("hours"))
    });

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
