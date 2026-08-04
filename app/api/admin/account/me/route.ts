import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** מחזיר את פרטי המשתמש המחובר (אימייל, תפקיד, בתי כנסת מורשים). */
export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    data: {
      email: ctx.email,
      role: ctx.role,
      synagogueIds: ctx.synagogueIds,
      mustChangePassword: ctx.mustChangePassword
    }
  });
}
