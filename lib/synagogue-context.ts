import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const DEFAULT_TITLE = "מערכת בית כנסת";

export async function getActiveSynagogueTitle() {
  const cookieStore = await cookies();
  const synagogueId = cookieStore.get("synagogue_id")?.value ?? process.env.NEXT_PUBLIC_DEFAULT_SYNAGOGUE_ID;

  if (!synagogueId) {
    return DEFAULT_TITLE;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return DEFAULT_TITLE;
  }

  const { data } = await supabase.from("synagogues").select("name").eq("id", synagogueId).maybeSingle();
  return data?.name ?? DEFAULT_TITLE;
}

