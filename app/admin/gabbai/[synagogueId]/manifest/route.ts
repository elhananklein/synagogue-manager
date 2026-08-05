import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-z0-9-]{3,40}$/;

/**
 * Manifest פר-בית-כנסת.
 * חשוב: scope חייב לכלול גם /admin/login (הפניה בכניסה), אחרת Chrome באנדרואיד
 * יוצר רק קיצור דרך במקום WebAPK (אפליקציה).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ synagogueId: string }> }
) {
  const { synagogueId } = await params;
  const id = (synagogueId ?? "").trim().toLowerCase();
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 404 });
  }

  let name: string | null = null;
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const res = await supabase.from("synagogues").select("name").eq("id", id).maybeSingle();
    if (!res.error && res.data?.name) name = res.data.name as string;
  }

  const startUrl = `/admin/gabbai/${id}`;
  const manifest = {
    id: startUrl,
    name: name ? `ניהול — ${name}` : "ניהול בית הכנסת",
    short_name: "ניהול",
    description: "ניהול בית הכנסת שלי — זמני תפילה, מסכים והגדרות",
    start_url: startUrl,
    scope: "/admin",
    display: "standalone",
    orientation: "any",
    dir: "rtl",
    lang: "he",
    background_color: "#0f172a",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icons/admin-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/admin-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/admin-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-store"
    }
  });
}
