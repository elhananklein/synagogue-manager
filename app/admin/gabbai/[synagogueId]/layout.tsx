import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

/**
 * מטא-דאטה פר-בית-כנסת: מקשר ל-manifest הדינמי כדי שהתקנת האפליקציה
 * (אנדרואיד + אייפון) תיפתח ישר לניהול בית הכנסת הרלוונטי.
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
    manifest: `/admin/gabbai/${id}/manifest`,
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

export default function GabbaiSynagogueLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
