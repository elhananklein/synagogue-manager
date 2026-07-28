import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { purgeAllExpiredBulletinItems } from "@/lib/bulletin-board";
import { todayJerusalemIso } from "@/lib/bulletin-board-dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeAllExpiredBulletinItems();
    return NextResponse.json({
      ok: true,
      today: todayJerusalemIso(),
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "purge_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
