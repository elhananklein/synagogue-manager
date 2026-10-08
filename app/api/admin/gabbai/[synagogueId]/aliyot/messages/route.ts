import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { logAliyahMessage } from "@/lib/aliyah-message-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const payload = (await request.json().catch(() => ({}))) as {
    minyanId?: string;
    serviceDate?: string;
    congregantId?: string;
  };
  const minyanId = payload.minyanId?.trim() ?? "";
  const congregantId = payload.congregantId?.trim() ?? "";
  if (!minyanId) return NextResponse.json({ ok: false, error: "invalid_minyan" }, { status: 400 });
  if (!congregantId) return NextResponse.json({ ok: false, error: "invalid_congregant" }, { status: 400 });

  const logged = await logAliyahMessage({
    synagogueId: access.synagogueId,
    minyanId,
    serviceDate: payload.serviceDate?.trim() ?? "",
    congregantId,
    openedBy: access.ctx.userId
  });
  if (logged.error) {
    const status = ["invalid_minyan", "invalid_date", "invalid_congregant", "no_consent"].includes(logged.error) ? 400 : 500;
    return NextResponse.json({ ok: false, error: logged.error }, { status });
  }
  return NextResponse.json({ ok: true, data: { openedAt: logged.openedAt } });
}
