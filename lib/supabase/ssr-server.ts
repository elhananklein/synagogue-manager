import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client לצד השרת (Server Components / Route Handlers) שמנהל את הסשן
 * דרך cookies. משמש לקריאת המשתמש המחובר בלבד — פעולות מנהל רגישות עדיין
 * מתבצעות עם ה-service role client לאחר בדיקת הרשאה.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // ב-Server Component אי אפשר לכתוב cookies — ה-middleware מרענן במקום.
        }
      }
    }
  });
}
