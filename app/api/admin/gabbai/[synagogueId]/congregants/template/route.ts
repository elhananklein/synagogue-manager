import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { listSynagogueMinyanOptions } from "@/lib/congregant-db";
import { congregantTemplateBuffer } from "@/lib/congregant-excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;
  const minyanim = await listSynagogueMinyanOptions(access.synagogueId);
  const buffer = congregantTemplateBuffer(minyanim);
  return new NextResponse(Uint8Array.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="congregants-template.xlsx"'
    }
  });
}
