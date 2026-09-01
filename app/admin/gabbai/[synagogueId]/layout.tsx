import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GabbaiShell } from "@/components/admin/gabbai-shell";
import { canManageSynagogue, getAdminContext } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import "@/app/admin/gabbai/gabbai-ui.css";

/**
 * מטא-דאטה לניהול בית כנסת.
 * ה-PWA של הניהול משתמש ב-/admin.webmanifest (scope=/admin, start_url=/admin)
 * כדי ש-Chrome ייצור אפליקציה אמיתית — לא קיצור לדף /gabbai/...
 */
export async function generateMetadata({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}): Promise<Metadata> {
  const { synagogueId } = await params;
  const id = (synagogueId ?? "").trim().toLowerCase();

  let name: string | null = null;
  const supabase = getSupabaseAdminClient();
  if (supabase && /^[a-z0-9-]{3,40}$/.test(id)) {
    const res = await supabase.from("synagogues").select("name").eq("id", id).maybeSingle();
    if (!res.error && res.data?.name) name = res.data.name as string;
  }

  return {
    applicationName: name ? `ניהול — ${name}` : "ניהול בית הכנסת",
    title: name ? `ניהול — ${name}` : "ניהול בית הכנסת",
    manifest: "/admin.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: name ?? "ניהול"
    },
    icons: {
      icon: [
        { url: "/icons/admin-icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/admin-icon-512.png", sizes: "512x512", type: "image/png" }
      ],
      apple: [{ url: "/icons/admin-apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
    }
  };
}

export default async function GabbaiSynagogueLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = await params;
  const id = (synagogueId ?? "").trim().toLowerCase();

  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  if (!canManageSynagogue(ctx, id)) redirect("/admin");

  let name = id;
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const res = await supabase.from("synagogues").select("name").eq("id", id).maybeSingle();
    if (!res.error && res.data?.name) name = res.data.name as string;
  }

  return (
    <GabbaiShell
      synagogueId={id}
      synagogueName={name}
      adminHubHref={ctx.role === "system" ? "/admin" : ctx.synagogueIds.length > 1 ? "/admin/gabbai" : null}
      adminHubLabel={ctx.role === "system" ? "ממשק מנהל המערכת" : "בתי הכנסת שלי"}
    >
      {children}
    </GabbaiShell>
  );
}
