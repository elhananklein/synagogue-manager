import type { Metadata } from "next";

import { resolveSynagogueId, type DisplayViewParams } from "@/lib/build-display-view";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";
import { logoCacheVersion, synagoguePwaMetadataIcons } from "@/lib/synagogue-logo";

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

/** שם האפליקציה בשולחן העבודה / במסך הבית: «בית הכנסת <שם>». */
export function synagogueAppName(name?: string | null): string {
  const raw = name?.trim();
  if (!raw) return "בית הכנסת";
  return `בית הכנסת ${shortSynagogueName(raw)}`;
}

export async function generateDisplayMetadata(
  params: DisplayViewParams,
  options?: { mobilePwa?: boolean }
): Promise<Metadata> {
  const synagogueId = await resolveSynagogueId(params);
  let name: string | null = null;
  let logoUpdatedAt: string | null = null;
  if (synagogueId) {
    const supabase = getSupabaseAdminClient() ?? getSupabaseServerClient();
    if (supabase) {
      let data: { name?: string | null; logo_updated_at?: string | null } | null = null;
      const withLogo = await supabase
        .from("synagogues")
        .select("name, logo_updated_at")
        .eq("id", synagogueId)
        .maybeSingle();
      if (!withLogo.error && withLogo.data) {
        data = withLogo.data;
      } else {
        const fallback = await supabase.from("synagogues").select("name").eq("id", synagogueId).maybeSingle();
        if (fallback.data) data = fallback.data;
      }
      if (data?.name) name = String(data.name);
      if (typeof data?.logo_updated_at === "string") logoUpdatedAt = data.logo_updated_at;
    }
  }
  const title = synagoguePublicTitle(name);
  const appName = synagogueAppName(name);
  if (options?.mobilePwa) {
    return {
      title,
      applicationName: appName,
      manifest: synagogueId ? `/m/manifest/${synagogueId}` : "/manifest.webmanifest",
      appleWebApp: {
        capable: true,
        title: appName
      },
      icons: synagogueId ? synagoguePwaMetadataIcons(synagogueId, logoCacheVersion(logoUpdatedAt)) : undefined
    };
  }
  return {
    title,
    applicationName: title,
    appleWebApp: {
      capable: true,
      title
    }
  };
}
