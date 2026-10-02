import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { mapAliyahApiError } from "@/lib/aliyah-errors";
import { buildAliyahPlanDocument } from "@/lib/aliyah-plan-email";
import { isIsoDate } from "@/lib/hebrew-civil-date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** דף הדפסה של התכנון (A4) — נפתח בלשונית חדשה מעמוד התכנון. */
export async function GET(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const minyanId = url.searchParams.get("minyanId")?.trim() ?? "";
  const serviceDate = url.searchParams.get("date")?.trim() ?? "";
  if (!minyanId || !isIsoDate(serviceDate)) {
    return NextResponse.json({ ok: false, error: !minyanId ? "invalid_minyan" : "invalid_date" }, { status: 400 });
  }

  const doc = await buildAliyahPlanDocument(access.synagogueId, minyanId, serviceDate, { forPrint: true });
  if ("error" in doc) {
    return new NextResponse(`<p dir="rtl" style="font-family:sans-serif">${mapAliyahApiError(doc.error)}</p>`, {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }
  return new NextResponse(doc.document, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}
