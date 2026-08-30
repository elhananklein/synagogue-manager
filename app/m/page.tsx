import Link from "next/link";
import { Suspense } from "react";
import { Building2 } from "lucide-react";

import { MobileHomeRedirect } from "@/components/mobile/mobile-home-redirect";
import { MobileSynagogueSelector } from "@/components/mobile/mobile-synagogue-selector";
import { PwaInstallBanner } from "@/components/mobile/pwa-install";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function MobileHomePage() {
  const supabase = getSupabaseAdminClient();
  const synagogueResult = supabase
    ? await supabase.from("synagogues").select("id, name, created_at").order("created_at", { ascending: false })
    : null;

  const synagogues =
    synagogueResult?.data?.map((row) => ({
      id: row.id,
      name: row.name
    })) ?? [];

  return (
    <div className="m-shell">
      <Suspense fallback={null}>
        <MobileHomeRedirect />
      </Suspense>
      <header className="m-header m-header--simple">
        <Building2 className="h-5 w-5" />
        <span className="text-base font-extrabold">מערכת לניהול בתי כנסת</span>
      </header>

      <main className="m-main">
        <h1 className="m-title">ברוכים הבאים</h1>
        <p className="m-lead">בחרו בית כנסת כדי לצפות בזמני התפילה והלימוד.</p>
        <PwaInstallBanner className="mb-5" />
        <MobileSynagogueSelector synagogues={synagogues} />
      </main>

      <footer className="m-footer m-footer--links">
        <Link href="/contact">צור קשר</Link>
        <Link href="/admin/login">כניסה כמנהל</Link>
      </footer>
    </div>
  );
}
