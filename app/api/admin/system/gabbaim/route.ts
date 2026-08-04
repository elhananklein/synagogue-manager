import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { generateTempPassword } from "@/lib/temp-password";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireSystem() {
  const ctx = await getAdminContext();
  if (!ctx) return { error: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  if (ctx.role !== "system")
    return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { ctx };
}

function normalizeSynagogueIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
        .filter((v) => /^[a-z0-9-]{3,40}$/.test(v))
    )
  );
}

/** רשימת הגבאים: כל admin_users בתפקיד gabbai + בתי הכנסת שלהם + אימייל. */
export async function GET() {
  const auth = await requireSystem();
  if ("error" in auth) return auth.error;

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });

  const { data: rows, error } = await admin
    .from("admin_users")
    .select("user_id, role, display_name, must_change_password, created_at")
    .eq("role", "gabbai");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: links } = await admin.from("synagogue_admins").select("user_id, synagogue_id");
  const byUser = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = byUser.get(l.user_id as string) ?? [];
    arr.push(l.synagogue_id as string);
    byUser.set(l.user_id as string, arr);
  }

  const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailByUser = new Map<string, string>();
  for (const u of usersList?.users ?? []) emailByUser.set(u.id, u.email ?? "");

  const data = (rows ?? []).map((r) => ({
    userId: r.user_id as string,
    email: emailByUser.get(r.user_id as string) ?? null,
    displayName: r.display_name as string | null,
    mustChangePassword: Boolean(r.must_change_password),
    synagogueIds: byUser.get(r.user_id as string) ?? [],
    createdAt: r.created_at as string
  }));

  return NextResponse.json({ ok: true, data });
}

/** יצירת גבאי חדש: מייצר סיסמה זמנית, יוצר משתמש, ומחזיר את הסיסמה למסירה ידנית. */
export async function POST(request: Request) {
  const auth = await requireSystem();
  if ("error" in auth) return auth.error;

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });

  const body = (await request.json()) as { email?: string; displayName?: string; synagogueIds?: unknown };
  const email = (body.email ?? "").trim().toLowerCase();
  const displayName = (body.displayName ?? "").trim() || null;
  const synagogueIds = normalizeSynagogueIds(body.synagogueIds);

  if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  if (synagogueIds.length === 0)
    return NextResponse.json({ ok: false, error: "no_synagogues" }, { status: 400 });

  // ודא שכל בתי הכנסת קיימים
  const { data: existing } = await admin.from("synagogues").select("id").in("id", synagogueIds);
  const existingIds = new Set((existing ?? []).map((s) => s.id as string));
  const missing = synagogueIds.filter((id) => !existingIds.has(id));
  if (missing.length) return NextResponse.json({ ok: false, error: "synagogue_not_found" }, { status: 400 });

  const tempPassword = generateTempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { must_change_password: true }
  });
  if (createError || !created?.user) {
    const msg = createError?.message ?? "create_failed";
    const code = /already/i.test(msg) ? "email_exists" : msg;
    return NextResponse.json({ ok: false, error: code }, { status: 400 });
  }

  const userId = created.user.id;
  const { error: adminRowError } = await admin
    .from("admin_users")
    .insert({ user_id: userId, role: "gabbai", display_name: displayName, must_change_password: true });
  if (adminRowError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ ok: false, error: adminRowError.message }, { status: 500 });
  }

  const { error: linkError } = await admin
    .from("synagogue_admins")
    .insert(synagogueIds.map((synagogue_id) => ({ user_id: userId, synagogue_id })));
  if (linkError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ ok: false, error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { userId, email, tempPassword } });
}

/** פעולות על גבאי קיים: איפוס סיסמה או עדכון בתי הכנסת המשויכים. */
export async function PATCH(request: Request) {
  const auth = await requireSystem();
  if ("error" in auth) return auth.error;

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });

  const body = (await request.json()) as { action?: string; userId?: string; synagogueIds?: unknown };
  const action = body.action;
  const userId = (body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ ok: false, error: "missing_user_id" }, { status: 400 });

  // ודא שזה אכן גבאי מנוהל
  const { data: target } = await admin
    .from("admin_users")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target || target.role !== "gabbai")
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (action === "reset_password") {
    const tempPassword = generateTempPassword();
    const { error: pwError } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
      app_metadata: { must_change_password: true }
    });
    if (pwError) return NextResponse.json({ ok: false, error: pwError.message }, { status: 500 });
    await admin.from("admin_users").update({ must_change_password: true }).eq("user_id", userId);
    return NextResponse.json({ ok: true, data: { tempPassword } });
  }

  if (action === "set_synagogues") {
    const synagogueIds = normalizeSynagogueIds(body.synagogueIds);
    if (synagogueIds.length === 0)
      return NextResponse.json({ ok: false, error: "no_synagogues" }, { status: 400 });
    const { data: existing } = await admin.from("synagogues").select("id").in("id", synagogueIds);
    const existingIds = new Set((existing ?? []).map((s) => s.id as string));
    if (synagogueIds.some((id) => !existingIds.has(id)))
      return NextResponse.json({ ok: false, error: "synagogue_not_found" }, { status: 400 });

    await admin.from("synagogue_admins").delete().eq("user_id", userId);
    const { error: linkError } = await admin
      .from("synagogue_admins")
      .insert(synagogueIds.map((synagogue_id) => ({ user_id: userId, synagogue_id })));
    if (linkError) return NextResponse.json({ ok: false, error: linkError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
}

/** מחיקת גבאי (מוחק את המשתמש; ה-FK מוחק את השורות המשויכות). */
export async function DELETE(request: Request) {
  const auth = await requireSystem();
  if ("error" in auth) return auth.error;

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "missing_service_role_key" }, { status: 500 });

  const body = (await request.json()) as { userId?: string };
  const userId = (body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ ok: false, error: "missing_user_id" }, { status: 400 });

  const { data: target } = await admin
    .from("admin_users")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target || target.role !== "gabbai")
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
