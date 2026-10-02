import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { saveAliyahPlanSettings } from "@/lib/aliyah-plan-db";
import type { AliyahPlanSettings } from "@/lib/aliyah-plan-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const payload = (await request.json().catch(() => ({}))) as { minyanId?: string; settings?: Partial<AliyahPlanSettings> };
  const minyanId = payload.minyanId?.trim() ?? "";
  if (!minyanId) return NextResponse.json({ ok: false, error: "invalid_minyan" }, { status: 400 });

  const saved = await saveAliyahPlanSettings(access.synagogueId, minyanId, payload.settings ?? {});
  if (saved.error) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: saved.error === "invalid_minyan" ? 400 : 500 });
  }
  return NextResponse.json({ ok: true, data: { settings: saved.settings } });
}
