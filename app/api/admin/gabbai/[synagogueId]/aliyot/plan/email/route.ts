import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { sendAliyahPlanEmail } from "@/lib/aliyah-plan-email";
import { isIsoDate } from "@/lib/hebrew-civil-date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const payload = (await request.json().catch(() => ({}))) as { minyanId?: string; serviceDate?: string };
  const minyanId = payload.minyanId?.trim() ?? "";
  const serviceDate = payload.serviceDate?.trim() ?? "";
  if (!minyanId) return NextResponse.json({ ok: false, error: "invalid_minyan" }, { status: 400 });
  if (!isIsoDate(serviceDate)) return NextResponse.json({ ok: false, error: "invalid_date" }, { status: 400 });

  const res = await sendAliyahPlanEmail(access.synagogueId, minyanId, [serviceDate]);
  if (!res.ok) {
    const status = res.error === "invalid_minyan" || res.error === "no_recipients" ? 400 : 500;
    return NextResponse.json({ ok: false, error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, data: { recipients: res.recipients ?? [] } });
}
