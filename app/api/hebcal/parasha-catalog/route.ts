import { NextResponse } from "next/server";
import { fetchJerusalemParashaCatalogKeys } from "@/lib/parasha-catalog-hebcal";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const keys = await fetchJerusalemParashaCatalogKeys();
    return NextResponse.json({ ok: true, keys });
  } catch {
    return NextResponse.json({ ok: false, keys: [] as string[] }, { status: 200 });
  }
}
