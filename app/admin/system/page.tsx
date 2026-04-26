"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SynagogueItem = { id: string; name: string; created_at: string };

function mapApiError(error?: string) {
  if (!error) return "הפעולה נכשלה";
  if (error === "missing_service_role_key") return "חסר משתנה סביבה SUPABASE_SERVICE_ROLE_KEY בצד השרת.";
  if (error === "invalid_id") return "המזהה חייב להכיל רק אותיות באנגלית קטנות, מספרים ומקף (3-40 תווים).";
  if (error === "missing_name") return "יש להזין שם בית כנסת.";
  if (error.includes("duplicate key")) return "המזהה כבר קיים במערכת. בחר מזהה אחר.";
  if (error.includes("row-level security")) return "אין הרשאת כתיבה לטבלה (RLS). יש להגדיר service role key.";
  return error;
}

export default function SystemAdminPage() {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [items, setItems] = useState<SynagogueItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/admin/system/synagogues", { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; data?: SynagogueItem[]; error?: string };
    if (payload.ok) {
      setItems(payload.data ?? []);
      return;
    }
    setError(mapApiError(payload.error));
  }

  useEffect(() => {
    void load();
  }, []);

  async function createSynagogue(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const response = await fetch("/api/admin/system/synagogues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name })
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setError(mapApiError(payload.error));
      return;
    }
    setMessage("בית כנסת נוצר בהצלחה");
    setId("");
    setName("");
    await load();
  }

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-bold">ממשק מנהל מערכת</h1>
      <p className="mt-2 text-muted-foreground">כאן יוצרים בתי כנסת חדשים ומקבלים מזהה לניהול גבאים.</p>

      <Card className="mt-6 max-w-3xl">
        <CardHeader>
          <CardTitle>הגדרת בית כנסת חדש</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={createSynagogue}>
            <label className="text-sm font-medium">מזהה בית כנסת (id)</label>
            <input
              className="h-10 rounded-md border border-border bg-background px-3"
              placeholder="beit-rimon"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
            />
            <label className="text-sm font-medium">שם בית כנסת</label>
            <input
              className="h-10 rounded-md border border-border bg-background px-3"
              placeholder='בית כנסת "בית רימון"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="flex items-center gap-3">
              <Button type="submit">צור בית כנסת</Button>
              {message ? <span className="text-sm text-green-600">{message}</span> : null}
              {error ? <span className="text-sm text-red-600">{error}</span> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-3xl">
        <CardHeader>
          <CardTitle>בתי כנסת מוגדרים</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3 text-sm">
                <div className="font-semibold">{item.name}</div>
                <div className="text-muted-foreground">id: {item.id}</div>
                <a className="text-primary underline" href={`/admin/gabbai/${item.id}`}>
                  כניסה לממשק גבאי
                </a>
              </li>
            ))}
            {!items.length ? <li className="text-sm text-muted-foreground">אין עדיין בתי כנסת מוגדרים</li> : null}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

