import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr-server";

export const dynamic = "force-dynamic";

/**
 * נקודת חזרה מקישורי הזדהות של Supabase (איפוס סיסמה).
 * מחליף את ה-code בסשן ומפנה לבחירת סיסמה חדשה.
 *
 * הערה: redirectTo בבקשת האיפוס חייב להיות בדיוק /auth/callback (בלי ?next=)
 * כדי להתאים לרשימת Redirect URLs ב-Supabase.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/admin/change-password?recovery=1", url.origin));
    }
  }

  const login = new URL("/admin/login", url.origin);
  login.searchParams.set("error", "recovery_failed");
  return NextResponse.redirect(login);
}
