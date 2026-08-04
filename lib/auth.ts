import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr-server";

export type AdminRole = "system" | "gabbai";

export type AdminContext = {
  userId: string;
  email: string | null;
  role: AdminRole;
  /** בתי כנסת שהגבאי מנהל. עבור system — ריק (יש לו גישה לכולם). */
  synagogueIds: string[];
  mustChangePassword: boolean;
};

/**
 * מחזיר את הקשר הניהול של המשתמש המחובר, או null אם לא מחובר / לא מוגדר כאדמין.
 * מקור האמת הוא טבלאות admin_users / synagogue_admins (נקראות עם service role).
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data: row } = await admin
    .from("admin_users")
    .select("role, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) return null; // מאומת אך אינו אדמין

  let synagogueIds: string[] = [];
  if (row.role === "gabbai") {
    const { data: links } = await admin
      .from("synagogue_admins")
      .select("synagogue_id")
      .eq("user_id", user.id);
    synagogueIds = (links ?? []).map((l) => l.synagogue_id as string);
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: row.role as AdminRole,
    synagogueIds,
    mustChangePassword: Boolean(row.must_change_password)
  };
}

export function canManageSynagogue(ctx: AdminContext, synagogueId: string): boolean {
  return ctx.role === "system" || ctx.synagogueIds.includes(synagogueId);
}

export function isSystemAdmin(ctx: AdminContext): boolean {
  return ctx.role === "system";
}
