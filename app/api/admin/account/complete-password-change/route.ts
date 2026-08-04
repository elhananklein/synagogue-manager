import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** מסמן שהמשתמש המחובר סיים להחליף סיסמה — מבטל את דגל חובת ההחלפה. */
export async function POST() {
  const ctx = await getAdminContext();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });
  }

  const { error: dbError } = await admin
    .from("admin_users")
    .update({ must_change_password: false })
    .eq("user_id", ctx.userId);
  if (dbError) {
    return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(ctx.userId, {
    app_metadata: { must_change_password: false }
  });
  if (metaError) {
    return NextResponse.json({ ok: false, error: metaError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
