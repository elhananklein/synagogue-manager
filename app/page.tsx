import { SynagogueSelector } from "@/components/home/synagogue-selector";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
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
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container py-10">
        <section className="mb-8 text-center md:mb-12">
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">ברוכים המבאים למערכת ניהול בתי כנסת</h1>
        </section>

        <SynagogueSelector synagogues={synagogues} />
      </main>

      <SiteFooter />
    </div>
  );
}
