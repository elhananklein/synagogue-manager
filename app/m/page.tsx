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
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <Suspense fallback={null}>
        <MobileHomeRedirect />
      </Suspense>
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white/85 px-4 py-4 backdrop-blur">
        <Building2 className="h-5 w-5 text-emerald-600" />
        <span className="text-base font-bold">מערכת ניהול לבתי כנסת</span>
      </header>

      <main className="flex-1 px-4 py-6">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">ברוכים הבאים</h1>
        <p className="mb-5 text-sm text-slate-500">בחרו בית כנסת כדי לצפות בזמני התפילה והלימוד.</p>
        <PwaInstallBanner className="mb-5" />
        <MobileSynagogueSelector synagogues={synagogues} />
      </main>

      <footer className="flex items-center justify-center border-t border-slate-200 bg-white px-4 py-3 text-sm">
        <Link href="/contact" className="text-slate-600">
          צור קשר
        </Link>
      </footer>
    </div>
  );
}
