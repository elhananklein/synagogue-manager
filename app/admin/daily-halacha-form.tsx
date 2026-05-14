"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type HalachaFormState = {
  displayDay: number;
  title: string;
  content: string;
  published: boolean;
};

const INITIAL_FORM: HalachaFormState = {
  displayDay: 1,
  title: "",
  content: "",
  published: true
};

export function DailyHalachaForm() {
  const [form, setForm] = useState<HalachaFormState>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-halacha", { cache: "no-store" });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: {
          display_day: number;
          title: string;
          content: string;
          published: boolean;
        } | null;
        error?: string;
      };

      if (!payload.ok) {
        setError(payload.error ?? "טעינת ההלכה נכשלה");
        return;
      }

      if (payload.data) {
        setForm({
          displayDay: payload.data.display_day,
          title: payload.data.title,
          content: payload.data.content,
          published: payload.data.published
        });
      } else {
        setForm(INITIAL_FORM);
      }
    } catch {
      setError("טעינת ההלכה נכשלה");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/daily-halacha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!payload.ok) {
        setError(payload.error ?? "שמירת ההלכה נכשלה");
        return;
      }

      setMessage("ההלכה נשמרה בטבלה.");
      await loadLatest();
    } catch {
      setError("שמירת ההלכה נכשלה");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ניהול הלכה יומית</CardTitle>
        <CardDescription>
          הוספה ועריכה ידנית בלבד — השמירה נכנסת לטבלת <code className="rounded bg-muted px-1">daily_halacha</code> תחת מפתח{" "}
          <code className="rounded bg-muted px-1">manual</code>. יום להצגה ייחודי לכל שורה (אותו יום = עדכון השורה הקיימת).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען נתונים...</p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor="displayDay">
                יום להצגה (מספר סידורי במחזור)
              </label>
              <input
                id="displayDay"
                type="number"
                min={1}
                value={form.displayDay}
                onChange={(event) => setForm((prev) => ({ ...prev, displayDay: Number(event.target.value) }))}
                className="h-10 w-full rounded-md border border-border bg-background px-3"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor="title">
                כותרת
              </label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-background px-3"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor="content">
                תוכן
              </label>
              <textarea
                id="content"
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                className="min-h-36 w-full rounded-md border border-border bg-background px-3 py-2"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(event) => setForm((prev) => ({ ...prev, published: event.target.checked }))}
              />
              פרסום פעיל (מסך תצוגה ציבורי)
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "שומר..." : "שמור / עדכן הלכה"}
              </Button>
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => void loadLatest()}>
                רענן מהטבלה
              </Button>
              {message ? <p className="text-sm text-green-600">{message}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
