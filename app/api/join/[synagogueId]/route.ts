import { NextResponse } from "next/server";
import { getPublicJoinContext, insertCongregant } from "@/lib/congregant-db";
import { emptyCongregantInput, validateCongregantInput, type CongregantInput } from "@/lib/congregant-types";
import { parseSynagogueId } from "@/lib/synagogue-id";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const synagogueId = parseSynagogueId(rawId);
  if (!synagogueId) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  const ctx = await getPublicJoinContext(synagogueId);
  if ("error" in ctx) {
    const status = ctx.error === "synagogue_not_found" ? 404 : 500;
    return NextResponse.json({ ok: false, error: ctx.error }, { status });
  }
  return NextResponse.json({ ok: true, data: ctx });
}

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const synagogueId = parseSynagogueId(rawId);
  if (!synagogueId) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

  const ctx = await getPublicJoinContext(synagogueId);
  if ("error" in ctx) {
    const status = ctx.error === "synagogue_not_found" ? 404 : 500;
    return NextResponse.json({ ok: false, error: ctx.error }, { status });
  }

  const payload = (await request.json()) as Partial<CongregantInput> & { website?: string };
  if (payload.website?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const minyanIds = new Set(ctx.minyanim.map((item) => item.id));
  const input: CongregantInput = {
    ...emptyCongregantInput(),
    ...payload,
    isActive: true,
    notes: "",
    registrationStatus: "pending"
  };
  const validated = validateCongregantInput(input, minyanIds, { requirePhone: true });
  if (validated.errors.length) {
    return NextResponse.json({ ok: false, error: validated.errors[0], errors: validated.errors }, { status: 400 });
  }
  const saved = await insertCongregant(synagogueId, { ...validated.next, registrationStatus: "pending", notes: "" });
  if (saved.error) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
