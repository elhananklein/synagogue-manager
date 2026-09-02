import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { parseSynagogueId } from "@/lib/synagogue-id";
import { logoCacheVersion, synagoguePwaManifestIcons } from "@/lib/synagogue-logo";
import { synagogueAppName } from "@/lib/synagogue-public-title";

export const dynamic = "force-dynamic";

/**
 * Manifest ציבורי פר-בית-כנסת.
 * start_url מצביע ישר לתצוגת המובייל של אותו בית כנסת,
 * והשם בשולחן העבודה הוא «בית הכנסת <שם>».
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ synagogueId: string }> }
) {
  const { synagogueId } = await params;
  const id = parseSynagogueId(synagogueId);
  if (!id) {
    return NextResponse.json({ error: "invalid_id" }, { status: 404 });
  }

  let name: string | null = null;
  let logoUpdatedAt: string | null = null;
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const withLogo = await supabase.from("synagogues").select("name, logo_updated_at").eq("id", id).maybeSingle();
    if (!withLogo.error && withLogo.data) {
      if (withLogo.data.name) name = withLogo.data.name as string;
      if (typeof withLogo.data.logo_updated_at === "string") logoUpdatedAt = withLogo.data.logo_updated_at;
    } else {
      const res = await supabase.from("synagogues").select("name").eq("id", id).maybeSingle();
      if (!res.error && res.data?.name) name = res.data.name as string;
    }
  }

  const appName = synagogueAppName(name);
  const startUrl = `/m/display?synagogueId=${id}`;
  const version = logoCacheVersion(logoUpdatedAt);
  const manifest = {
    id: startUrl,
    name: appName,
    short_name: appName,
    description: `${appName} — זמני תפילה, הלכה יומית ועדכונים`,
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    orientation: "any",
    dir: "rtl",
    lang: "he",
    background_color: "#f3ead8",
    theme_color: "#6b1a2e",
    icons: synagoguePwaManifestIcons(id, version)
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-store"
    }
  });
}
