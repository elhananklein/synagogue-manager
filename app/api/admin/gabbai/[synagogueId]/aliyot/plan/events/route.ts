import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { addChiyuvEvent, deleteChiyuvEvent } from "@/lib/aliyah-plan-db";
import { isManualChiyuvKind } from "@/lib/aliyah-plan-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLIENT_ERRORS = new Set(["invalid_minyan", "invalid_date", "invalid_congregant", "invalid_slot", "invalid_kind"]);

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const minyanId = typeof payload.minyanId === "string" ? payload.minyanId.trim() : "";
  const congregantId = typeof payload.congregantId === "string" ? payload.congregantId.trim() : "";
  const serviceDate = typeof payload.serviceDate === "string" ? payload.serviceDate.trim() : "";
  const preferredSlot = typeof payload.preferredSlot === "string" && payload.preferredSlot.trim() ? payload.preferredSlot.trim() : null;
  const notes = typeof payload.notes === "string" ? payload.notes.slice(0, 200) : "";
  if (!minyanId) return NextResponse.json({ ok: false, error: "invalid_minyan" }, { status: 400 });
  if (!congregantId) return NextResponse.json({ ok: false, error: "invalid_congregant" }, { status: 400 });
  if (!isManualChiyuvKind(payload.kind)) return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });

  const res = await addChiyuvEvent(access.synagogueId, minyanId, {
    congregantId,
    serviceDate,
    kind: payload.kind,
    preferredSlot,
    notes
  });
  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error }, { status: CLIENT_ERRORS.has(res.error) ? 400 : 500 });
  }
  return NextResponse.json({ ok: true, data: { event: res.event } });
}

export async function DELETE(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  const res = await deleteChiyuvEvent(access.synagogueId, id);
  if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
