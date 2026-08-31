import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { synagoguePublicTitle } from "@/lib/synagogue-public-title";

export async function getActiveSynagogueTitle() {
  const cookieStore = await cookies();
  const synagogueId = cookieStore.get("synagogue_id")?.value ?? process.env.NEXT_PUBLIC_DEFAULT_SYNAGOGUE_ID;

  if (!synagogueId) {
    return synagoguePublicTitle(null);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return synagoguePublicTitle(null);
  }

  const { data } = await supabase.from("synagogues").select("name").eq("id", synagogueId).maybeSingle();
  return synagoguePublicTitle(data?.name ?? null);
}

