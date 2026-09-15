import { NextResponse } from "next/server";

import { getSiddurContent } from "@/lib/data/sefaria-siddur";
import { isHaftarahMinhag, resolveHaftarahMinhag } from "@/lib/haftarah-minhag";
import { isSiddurPrayer } from "@/lib/siddur";

export const maxDuration = 60;
export const revalidate = 86400;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prayer = searchParams.get("prayer")?.trim() ?? "";
  const nusachRaw = searchParams.get("nusach")?.trim() ?? "";
  if (!isSiddurPrayer(prayer) || (nusachRaw && !isHaftarahMinhag(nusachRaw))) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const content = await getSiddurContent(resolveHaftarahMinhag(nusachRaw), prayer);
    if (!content) return NextResponse.json({ ok: false }, { status: 503 });
    return NextResponse.json(
      { ok: true, content },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
