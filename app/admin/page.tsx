import { DailyHalachaForm } from "@/app/admin/daily-halacha-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-bold">אזור ניהול</h1>
      <p className="mt-3 text-muted-foreground">
        ממשק מפוצל: מנהל מערכת (יצירת בתי כנסת) וגבאי (ניהול בית כנסת ספציפי).
      </p>

      <div className="mt-4 flex gap-3">
        <Button asChild variant="outline">
          <Link href="/admin/system">ממשק מנהל מערכת</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/gabbai">ממשק גבאי</Link>
        </Button>
      </div>

      <section className="mt-8 max-w-3xl">
        <DailyHalachaForm />
      </section>

      <section className="mt-8 max-w-3xl rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        מסך תצוגה ראשי זמין בנתיב <span className="font-semibold">/display</span>. בשלב הבא נוסיף מכאן שליטה על מסכים מתחלפים.
      </section>
    </main>
  );
}
