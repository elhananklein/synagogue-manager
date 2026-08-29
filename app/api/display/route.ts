import { NextResponse } from "next/server";
import { buildDisplayView, type DisplayViewParams } from "@/lib/build-display-view";

export const dynamic = "force-dynamic";

function param(searchParams: URLSearchParams, key: string): string | undefined {
  const value = searchParams.get(key);
  return value && value.trim() ? value : undefined;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceTile = searchParams.getAll("forceTile");
    const params: DisplayViewParams = {
      synagogueId: param(searchParams, "synagogueId"),
      minyan: param(searchParams, "minyan"),
      minyanId: param(searchParams, "minyanId"),
      forceYaaleh: param(searchParams, "forceYaaleh"),
      forceOmer: param(searchParams, "forceOmer"),
      forceAdditions: param(searchParams, "forceAdditions"),
      forceTile: forceTile.length ? forceTile : undefined,
      style: param(searchParams, "style"),
      palette: param(searchParams, "palette")
    };
    const view = await buildDisplayView(params);
    return NextResponse.json({ ok: true, view });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
