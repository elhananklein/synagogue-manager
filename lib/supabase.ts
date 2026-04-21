import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Keeping this warning for local development bootstrap.
  // App still compiles and lets you build UI first.
  console.warn("Supabase environment variables are missing.");
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
