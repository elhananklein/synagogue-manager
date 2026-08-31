import type { Metadata } from "next";

import { resolveSynagogueId, type DisplayViewParams } from "@/lib/build-display-view";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";

const FALLBACK_TITLE = "מידע ועדכונים";

/** מסיר קידומת «בית הכנסת» / «בית כנסת» אם השם כבר כולל אותה. */
function shortSynagogueName(name: string): string {
  const stripped = name
    .replace(/^\s*בית[\s\-]*הכנסת[\s\-]*/u, "")
    .replace(/^\s*בית[\s\-]*כנסת[\s\-]*/u, "")
    .trim();
  return stripped || name.trim();
}

export function synagoguePublicTitle(name?: string | null): string {
  const raw = name?.trim();
  if (!raw) return FALLBACK_TITLE;
  return `בית הכנסת ${shortSynagogueName(raw)} - מידע ועדכונים`;
}

export async function generateDisplayMetadata(params: DisplayViewParams): Promise<Metadata> {
  const synagogueId = await resolveSynagogueId(params);
  let name: string | null = null;
  if (synagogueId) {
    const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.from("synagogues").select("name").eq("id", synagogueId).maybeSingle();
      if (data?.name) name = String(data.name);
    }
  }
  const title = synagoguePublicTitle(name);
  return {
    title,
    applicationName: title,
    appleWebApp: {
      capable: true,
      title
    }
  };
}
