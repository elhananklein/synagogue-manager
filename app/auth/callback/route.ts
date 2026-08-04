import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr-server";

export const dynamic = "force-dynamic";

/** מאפשר רק נתיבים פנימיים תחת /admin (מונע open redirect). */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/admin")) return "/admin";
  if (raw.startsWith("//")) return "/admin";
  return raw;
}

/**
 * נקודת חזרה מקישורי הזדהות של Supabase (איפוס סיסמה וכו').
 * מחליף את ה-code בסשן ומפנה לדף הבא.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const login = new URL("/admin/login", url.origin);
  login.searchParams.set("error", "recovery_failed");
  return NextResponse.redirect(login);
}
