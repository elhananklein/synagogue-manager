import { createBrowserClient } from "@supabase/ssr";

/** Supabase client לצד הדפדפן (טפסי התחברות/החלפת סיסמה). */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  return createBrowserClient(url, anonKey);
}
