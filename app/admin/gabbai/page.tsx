import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/admin/logout-button";
import { getAdminContext } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function listSynagogues(ids?: string[]): Promise<{ id: string; name: string }[]> {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];
  let query = admin.from("synagogues").select("id, name").order("name");
  if (ids) {
    if (!ids.length) return [];
    query = query.in("id", ids);
  }
  const { data } = await query;
  return (data ?? []).map((s) => ({ id: s.id as string, name: s.name as string }));
}

/**
 * בחירת בית כנסת לניהול:
 * - מנהל מערכת: כל בתי הכנסת
 * - גבאי: רק המשויכים אליו (ואם יש אחד — מעבר ישיר)
 */
export default async function GabbaiEntryPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");

  const synagogues =
    ctx.role === "system" ? await listSynagogues() : await listSynagogues(ctx.synagogueIds);

  if (ctx.role === "gabbai" && synagogues.length === 1) {
    redirect(`/admin/gabbai/${synagogues[0].id}`);
  }

  return (
    <main className="container py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {ctx.role === "system" ? "ניהול בית כנסת" : "בתי הכנסת שלי"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {ctx.role === "system"
              ? "כמנהל מערכת ניתן להיכנס לכל בית כנסת ולנהל אותו כמו גבאי."
              : "בחרו בית כנסת לניהול."}
          </p>
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
          <li className="text-sm text-muted-foreground">
            {ctx.role === "system"
              ? "אין עדיין בתי כנסת. צרו אחד בממשק מנהל המערכת."
              : "עדיין לא שויכת לבית כנסת. פנה למנהל המערכת."}
          </li>
        ) : null}
      </ul>

      {ctx.role === "system" ? (
        <p className="mt-6 text-sm">
          <Link href="/admin/system" className="text-primary underline">
            חזרה לממשק מנהל המערכת
          </Link>
        </p>
      ) : null}
    </main>
  );
}
