import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { deleteCongregant, getCongregant, listSynagogueMinyanOptions, setCongregantRegistrationStatus, updateCongregant } from "@/lib/congregant-db";
import { emptyCongregantInput, validateCongregantInput, type CongregantInput } from "@/lib/congregant-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ synagogueId: string; congregantId: string }> }) {
  const { synagogueId: rawId, congregantId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;
  const found = await getCongregant(access.synagogueId, congregantId);
  if (found.error || !found.row) {
    return NextResponse.json({ ok: false, error: found.error ?? "not_found" }, { status: found.error === "not_found" ? 404 : 500 });
  }
  const minyanim = await listSynagogueMinyanOptions(access.synagogueId);
  return NextResponse.json({ ok: true, data: { congregant: found.row, minyanim } });
}

export async function PUT(request: Request, context: { params: Promise<{ synagogueId: string; congregantId: string }> }) {
  const { synagogueId: rawId, congregantId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;
  const minyanim = await listSynagogueMinyanOptions(access.synagogueId);
  const minyanIds = new Set(minyanim.map((item) => item.id));
  const payload = (await request.json()) as Partial<CongregantInput>;
  const input: CongregantInput = { ...emptyCongregantInput(), ...payload };
  const validated = validateCongregantInput(input, minyanIds);
  if (validated.errors.length) {
    return NextResponse.json({ ok: false, error: validated.errors[0], errors: validated.errors }, { status: 400 });
  }
  const saved = await updateCongregant(access.synagogueId, congregantId, validated.next);
  if (saved.error) {
    const status = saved.error === "not_found" ? 404 : 400;
    return NextResponse.json({ ok: false, error: saved.error }, { status });
  }
  return NextResponse.json({ ok: true, data: saved.row });
}

export async function PATCH(request: Request, context: { params: Promise<{ synagogueId: string; congregantId: string }> }) {
  const { synagogueId: rawId, congregantId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;
  const payload = (await request.json()) as { action?: string };
  if (payload.action === "approve") {
    const saved = await setCongregantRegistrationStatus(access.synagogueId, congregantId, "approved");
    if (saved.error) {
      const status = saved.error === "not_found" ? 404 : 400;
      return NextResponse.json({ ok: false, error: saved.error }, { status });
    }
    return NextResponse.json({ ok: true, data: saved.row });
  }
  if (payload.action === "reject") {
    const result = await deleteCongregant(access.synagogueId, congregantId);
    if (result.error) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ synagogueId: string; congregantId: string }> }) {
  const { synagogueId: rawId, congregantId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;
  const result = await deleteCongregant(access.synagogueId, congregantId);
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
