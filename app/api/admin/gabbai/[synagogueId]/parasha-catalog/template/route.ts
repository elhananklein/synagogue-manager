import { NextResponse } from "next/server";
import { fetchJerusalemParashaCatalogKeys } from "@/lib/parasha-catalog-hebcal";
import { buildParashaCatalogTemplateCsv } from "@/lib/parasha-prayer-catalog";
import { canManageSynagogue, getAdminContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId } = await context.params;
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!canManageSynagogue(ctx, synagogueId))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const keys = await fetchJerusalemParashaCatalogKeys();
  const csv = buildParashaCatalogTemplateCsv(keys);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="parasha-prayer-times.csv"'
    }
  });
}
