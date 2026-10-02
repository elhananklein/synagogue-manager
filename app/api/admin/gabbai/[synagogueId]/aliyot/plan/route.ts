import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { getAliyahPlan, saveAliyahPlan } from "@/lib/aliyah-plan-db";
import type { AliyahPlanSlotInput } from "@/lib/aliyah-plan-types";
import { nextAliyahServiceDate } from "@/lib/aliyah-recommend";
import { addDaysIso, aliyahDayKind, aliyahOccasionTitle, jerusalemTodayIso } from "@/lib/aliyah-slots";
import { toAliyahCongregantOption } from "@/lib/aliyah-types";
import { listSynagogueMinyanOptions } from "@/lib/congregant-db";
import { isIsoDate } from "@/lib/hebrew-civil-date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLIENT_ERRORS = new Set(["invalid_minyan", "invalid_date", "invalid_congregant", "invalid_slot"]);

function errorResponse(error: string) {
  return NextResponse.json({ ok: false, error }, { status: CLIENT_ERRORS.has(error) ? 400 : 500 });
}

/** אחרי 19:00 בערב — מתחילים מהיום הבא (מוצאי שבת → השבת הבאה). */
function plannerStartIso(now = new Date()) {
  const today = jerusalemTodayIso(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hour12: false }).format(now)
  );
  return hour >= 19 ? addDaysIso(today, 1) : today;
}

function upcomingOccasions(fromIso: string, days = 200) {
  const out: Array<{ iso: string; label: string }> = [];
  for (let offset = 0; offset <= days; offset += 1) {
    const iso = addDaysIso(fromIso, offset);
    if (aliyahDayKind(iso) === "other") continue;
    out.push({ iso, label: aliyahOccasionTitle(iso) });
  }
  return out;
}

function parseLocked(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

function parseSlots(raw: unknown): AliyahPlanSlotInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AliyahPlanSlotInput[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const slotKey = String(row.slotKey ?? "").trim();
    if (!slotKey || !Array.isArray(row.candidates)) return null;
    out.push({
      slotKey,
      sortOrder: typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder) ? row.sortOrder : index,
      locked: row.locked === true,
      candidates: row.candidates.map((candidate) => {
        const c = (candidate ?? {}) as Record<string, unknown>;
        return {
          congregantId: typeof c.congregantId === "string" && c.congregantId.trim() ? c.congregantId.trim() : null,
          reason: typeof c.reason === "string" ? c.reason : ""
        };
      })
    });
  }
  return out;
}

export async function GET(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const start = plannerStartIso();
  const requestedDate = url.searchParams.get("date")?.trim() ?? "";
  const serviceDate = isIsoDate(requestedDate) ? requestedDate : nextAliyahServiceDate(start);
  const minyanim = await listSynagogueMinyanOptions(access.synagogueId);
  const minyanId = url.searchParams.get("minyanId")?.trim() || minyanim[0]?.id || "";
  const occasions = upcomingOccasions(addDaysIso(start, -7));
  if (!occasions.some((item) => item.iso === serviceDate)) {
    occasions.push({ iso: serviceDate, label: aliyahOccasionTitle(serviceDate) || serviceDate });
    occasions.sort((a, b) => a.iso.localeCompare(b.iso));
  }

  if (!minyanId) {
    return NextResponse.json({
      ok: true,
      data: { minyanim, congregants: [], occasions, serviceDate, defaultDate: nextAliyahServiceDate(start), plan: null, settings: null, events: [] }
    });
  }

  const res = await getAliyahPlan(access.synagogueId, minyanId, serviceDate);
  if (!res.plan || !res.context) return errorResponse(res.error ?? "plan_failed");

  return NextResponse.json({
    ok: true,
    data: {
      minyanim,
      congregants: res.context.congregants.map(toAliyahCongregantOption),
      occasions,
      serviceDate,
      defaultDate: nextAliyahServiceDate(start),
      plan: res.plan,
      settings: res.settings,
      events: res.events ?? [],
      warning: res.error ?? null
    }
  });
}

/** חישוב מחדש (לא שומר). שומר על העליות הנעולות. */
export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const payload = (await request.json().catch(() => ({}))) as { minyanId?: string; serviceDate?: string; locked?: unknown };
  const minyanId = payload.minyanId?.trim() ?? "";
  const serviceDate = payload.serviceDate?.trim() ?? "";
  if (!minyanId) return errorResponse("invalid_minyan");
  if (!isIsoDate(serviceDate)) return errorResponse("invalid_date");

  const res = await getAliyahPlan(access.synagogueId, minyanId, serviceDate, {
    locked: parseLocked(payload.locked),
    ignoreSaved: true
  });
  if (!res.plan) return errorResponse(res.error ?? "plan_failed");
  return NextResponse.json({ ok: true, data: { plan: res.plan, events: res.events ?? [], warning: res.error ?? null } });
}

export async function PUT(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const payload = (await request.json().catch(() => ({}))) as { minyanId?: string; serviceDate?: string; slots?: unknown };
  const minyanId = payload.minyanId?.trim() ?? "";
  const serviceDate = payload.serviceDate?.trim() ?? "";
  const slots = parseSlots(payload.slots);
  if (!minyanId) return errorResponse("invalid_minyan");
  if (!isIsoDate(serviceDate)) return errorResponse("invalid_date");
  if (!slots) return errorResponse("invalid_slot");

  const saved = await saveAliyahPlan(access.synagogueId, minyanId, serviceDate, slots);
  if (saved.error) return errorResponse(saved.error);
  const res = await getAliyahPlan(access.synagogueId, minyanId, serviceDate);
  if (!res.plan) return errorResponse(res.error ?? "plan_failed");
  return NextResponse.json({ ok: true, data: { plan: res.plan } });
}
