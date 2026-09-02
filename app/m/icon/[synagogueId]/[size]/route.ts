import { NextResponse } from "next/server";
import { isSynagogueIconSize } from "@/lib/synagogue-logo";
import { readSynagogueIconPng } from "@/lib/synagogue-logo-files";
import { parseSynagogueId } from "@/lib/synagogue-id";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ synagogueId: string; size: string }> }
) {
  const { synagogueId, size } = await params;
  const id = parseSynagogueId(synagogueId);
  if (!id || !isSynagogueIconSize(size)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const png = await readSynagogueIconPng(id, size);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
      }
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
