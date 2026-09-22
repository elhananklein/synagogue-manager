import Link from "next/link";
import { Flame } from "lucide-react";

import { SynagogueSelector, type HomeSynagogueOption } from "@/components/home/synagogue-selector";
import { RedirectHandheldToMobile } from "@/components/mobile/redirect-handheld-to-mobile";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import "./home.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = getSupabaseAdminClient();
  const [synagogueResult, minyanResult] = supabase
    ? await Promise.all([
        supabase.from("synagogues").select("id, name, created_at").order("created_at", { ascending: false }),
        supabase
          .from("minyanim")
          .select("id, name, synagogue_id, created_at, is_active")
          .eq("is_active", true)
          .order("created_at", { ascending: true })
      ])
    : [null, null];

  const minyanimBySynagogue = new Map<string, Array<{ index: number; name: string }>>();
  for (const row of minyanResult?.data ?? []) {
    const synagogueId = typeof row.synagogue_id === "string" ? row.synagogue_id : "";
    if (!synagogueId) continue;
    const list = minyanimBySynagogue.get(synagogueId) ?? [];
    list.push({
      index: list.length + 1,
      name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : `מניין ${list.length + 1}`
    });
    minyanimBySynagogue.set(synagogueId, list);
  }

  const synagogues: HomeSynagogueOption[] =
    synagogueResult?.data?.map((row) => ({
      id: row.id,
      name: row.name,
      minyanim: minyanimBySynagogue.get(row.id) ?? []
    })) ?? [];

  return (
    <div className="home-page">
      <RedirectHandheldToMobile />

      <header className="home-header">
        <div className="container home-header-inner">
          <div className="home-brand">
            <span className="home-brand-mark" aria-hidden>
              <Flame strokeWidth={2.25} />
            </span>
            <span className="home-brand-name">מערכת לניהול בתי כנסת</span>
          </div>
          <nav className="home-nav" aria-label="ניווט ראשי">
            <Link href="/contact">צור קשר</Link>
            <Link href="/admin/login" className="home-nav-admin">
              כניסה לניהול
            </Link>
          </nav>
        </div>
      </header>

      <main className="container home-main">
        <section className="home-hero">
          <p className="home-hero-kicker">תצוגת קיר · זמני תפילה · ניהול גבאי</p>
          <h1 className="home-hero-title">מערכת לניהול בתי כנסת</h1>
          <p className="home-hero-lead">בחרו בית כנסת ומניין כדי לפתוח את לוח התצוגה.</p>
        </section>

        <SynagogueSelector synagogues={synagogues} />
      </main>

      <footer className="home-footer">
        <div className="container home-footer-inner">
          <p>מערכת לניהול בתי כנסת</p>
          <p>בית רימון · 052-6480000</p>
        </div>
      </footer>
    </div>
  );
}
