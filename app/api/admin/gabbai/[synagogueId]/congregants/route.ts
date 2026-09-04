import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { insertCongregant, listCongregants, listSynagogueMinyanOptions } from "@/lib/congregant-db";
import { emptyCongregantInput, validateCongregantInput, type CongregantInput } from "@/lib/congregant-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const [list, minyanim] = await Promise.all([
    listCongregants(access.synagogueId),
    listSynagogueMinyanOptions(access.synagogueId)
  ]);
  if (list.error) {
    return NextResponse.json({ ok: false, error: list.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: { congregants: list.rows, minyanim } });
}

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const minyanim = await listSynagogueMinyanOptions(access.synagogueId);
  const minyanIds = new Set(minyanim.map((item) => item.id));
  const payload = (await request.json()) as Partial<CongregantInput>;
  const input: CongregantInput = {
    ...emptyCongregantInput(),
    ...payload,
    registrationStatus: "approved"
  };
  const validated = validateCongregantInput(input, minyanIds);
  if (validated.errors.length) {
    return NextResponse.json({ ok: false, error: validated.errors[0], errors: validated.errors }, { status: 400 });
  }
  const saved = await insertCongregant(access.synagogueId, validated.next);
  if (saved.error) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, data: saved.row });
}
