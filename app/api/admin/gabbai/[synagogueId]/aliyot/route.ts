import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { loadAliyahSheet, loadAliyahWorkspace, saveAliyahSheet } from "@/lib/aliyah-db";
import { defaultAliyahServiceDate, jerusalemTodayIso } from "@/lib/aliyah-slots";
import type { AliyahAssignmentInput, AliyahNoKohenResolution } from "@/lib/aliyah-types";
import { isIsoDate } from "@/lib/hebrew-civil-date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseAssignments(raw: unknown): AliyahAssignmentInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AliyahAssignmentInput[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const slotKey = String(row.slotKey ?? "").trim();
    if (!slotKey) return null;
    const congregantId = typeof row.congregantId === "string" && row.congregantId.trim() ? row.congregantId.trim() : null;
    const resolution = row.noKohenResolution;
    const noKohenResolution: AliyahNoKohenResolution | null =
      resolution === "yisrael" || resolution === "skip" ? resolution : null;
    out.push({
      slotKey,
      sortOrder: typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder) ? row.sortOrder : index,
      congregantId,
      noKohenResolution,
      notes: typeof row.notes === "string" ? row.notes : ""
    });
  }
  return out;
}

export async function GET(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const minyanId = url.searchParams.get("minyanId")?.trim() ?? "";
  const requestedDate = url.searchParams.get("date")?.trim() ?? "";
  const serviceDate = isIsoDate(requestedDate) ? requestedDate : defaultAliyahServiceDate(jerusalemTodayIso());

  const workspace = await loadAliyahWorkspace(access.synagogueId);
  if (workspace.error) {
    return NextResponse.json({ ok: false, error: workspace.error }, { status: 500 });
  }

  const selectedMinyan = minyanId || workspace.minyanim[0]?.id || "";
  if (!selectedMinyan) {
    return NextResponse.json({
      ok: true,
      data: {
        minyanim: workspace.minyanim,
        congregants: workspace.congregants ?? [],
        sheet: null,
        serviceDate
      }
    });
  }

  const loaded = await loadAliyahSheet(access.synagogueId, selectedMinyan, serviceDate);
  if (loaded.error) {
    const status = loaded.error === "invalid_minyan" || loaded.error === "invalid_date" ? 400 : 500;
    return NextResponse.json({ ok: false, error: loaded.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    data: {
      minyanim: workspace.minyanim,
      congregants: workspace.congregants ?? [],
      sheet: loaded.sheet,
      serviceDate
    }
  });
}

export async function PUT(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const payload = (await request.json()) as {
    minyanId?: string;
    serviceDate?: string;
    assignments?: unknown;
  };
  const minyanId = payload.minyanId?.trim() ?? "";
  const serviceDate = payload.serviceDate?.trim() ?? "";
  const assignments = parseAssignments(payload.assignments);
  if (!minyanId) return NextResponse.json({ ok: false, error: "invalid_minyan" }, { status: 400 });
  if (!isIsoDate(serviceDate)) return NextResponse.json({ ok: false, error: "invalid_date" }, { status: 400 });
  if (!assignments) return NextResponse.json({ ok: false, error: "invalid_slot" }, { status: 400 });

  const saved = await saveAliyahSheet(access.synagogueId, minyanId, serviceDate, assignments);
  if (saved.error) {
    const status =
      saved.error === "invalid_minyan" ||
      saved.error === "invalid_date" ||
      saved.error === "invalid_congregant" ||
      saved.error === "invalid_slot"
        ? 400
        : 500;
    return NextResponse.json({ ok: false, error: saved.error }, { status });
  }

  return NextResponse.json({ ok: true, data: { sheet: saved.sheet } });
}
