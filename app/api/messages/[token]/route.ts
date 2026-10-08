import { NextResponse } from "next/server";
import { isMessagesToken, setMessagesConsentByToken } from "@/lib/messages-consent-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!isMessagesToken(token)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const payload = (await request.json().catch(() => ({}))) as { consent?: unknown };
  if (typeof payload.consent !== "boolean") {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  const view = await setMessagesConsentByToken(token, payload.consent);
  if (!view) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: { consent: view.consent } });
}
