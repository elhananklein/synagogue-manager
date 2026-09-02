import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Building2 } from "lucide-react";

import { MobileHomeGate, MobileHomeWaiting } from "@/components/mobile/mobile-home-redirect";
import { MobileSynagogueSelector } from "@/components/mobile/mobile-synagogue-selector";
import { PwaInstallBanner } from "@/components/mobile/pwa-install";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { parseSynagogueId } from "@/lib/synagogue-id";

export const dynamic = "force-dynamic";

function singleParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function MobileHomePage({
  searchParams
}: {
  searchParams: Promise<{ pick?: string; synagogueId?: string; minyan?: string }>;
}) {
  const params = await searchParams;
  if (singleParam(params.pick) !== "1") {
    const cookieStore = await cookies();
    const sid =
      parseSynagogueId(singleParam(params.synagogueId)) ??
      parseSynagogueId(cookieStore.get("synagogue_id")?.value);
    if (sid) {
      const query = new URLSearchParams({ synagogueId: sid });
      const minyan = singleParam(params.minyan)?.trim();
      if (minyan) query.set("minyan", minyan);
      redirect(`/m/display?${query.toString()}`);
    }
  }

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
    <Suspense fallback={<MobileHomeWaiting message="נכנסים לבית הכנסת…" />}>
      <MobileHomeGate>
        <div className="m-shell">
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
      </MobileHomeGate>
    </Suspense>
  );
}
