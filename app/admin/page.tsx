import Link from "next/link";
import { redirect } from "next/navigation";
import { DailyHalachaForm } from "@/app/admin/daily-halacha-form";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/admin/logout-button";
import { getAdminContext } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function getSynagogueNames(ids: string[]): Promise<{ id: string; name: string }[]> {
  if (!ids.length) return [];
  const admin = getSupabaseAdminClient();
  if (!admin) return ids.map((id) => ({ id, name: id }));
  const { data } = await admin.from("synagogues").select("id, name").in("id", ids);
  return (data ?? []).map((s) => ({ id: s.id as string, name: s.name as string }));
}

export default async function AdminPage() {
  const ctx = await getAdminContext();

  // מאומת אך אינו מוגדר כאדמין במערכת.
  if (!ctx) {
    return (
      <main className="container py-10">
        <h1 className="text-2xl font-bold">אין הרשאה</h1>
        <p className="mt-3 text-muted-foreground">
          המשתמש שלך אינו מוגדר כמנהל או גבאי במערכת. פנה למנהל המערכת.
        </p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </main>
    );
  }

  // גבאי: מפנים ישירות לבית הכנסת היחיד שלו, או מציגים בחירה.
  if (ctx.role === "gabbai") {
    const synagogues = await getSynagogueNames(ctx.synagogueIds);
    if (synagogues.length === 1) {
      redirect(`/admin/gabbai/${synagogues[0].id}`);
    }
    return (
      <main className="container py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">בתי הכנסת שלי</h1>
            <p className="mt-2 text-muted-foreground">בחרו בית כנסת לניהול.</p>
          </div>
          <LogoutButton />
        </div>
        <ul className="mt-6 grid max-w-2xl gap-2">
          {synagogues.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/gabbai/${s.id}`}
                className="block rounded-md border border-border p-3 hover:bg-muted"
              >
                <span className="font-semibold">{s.name}</span>{" "}
                <span className="text-muted-foreground">({s.id})</span>
              </Link>
            </li>
          ))}
          {!synagogues.length ? (
            <li className="text-sm text-muted-foreground">עדיין לא שויכת לבית כנסת. פנה למנהל המערכת.</li>
          ) : null}
        </ul>
      </main>
    );
  }

  // מנהל מערכת.
  return (
    <main className="container py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">אזור ניהול</h1>
          <p className="mt-3 text-muted-foreground">מנהל מערכת (בתי כנסת וגבאים) וניהול תוכן משותף.</p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/admin/system">בתי כנסת וגבאים</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/gabbai">כניסה לניהול בית כנסת</Link>
        </Button>
      </div>

      <section className="mt-8 max-w-3xl">
        <DailyHalachaForm />
      </section>
    </main>
  );
}
