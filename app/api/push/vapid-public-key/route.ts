import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push-vapid";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json({ ok: false, error: "missing_vapid" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, publicKey: key });
}
