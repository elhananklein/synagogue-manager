"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type HalachaFormState = {
  halachaDate: string;
  title: string;
  content: string;
  published: boolean;
};

const INITIAL_FORM: HalachaFormState = {
  halachaDate: new Date().toISOString().slice(0, 10),
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

  useEffect(() => {
    let active = true;

    async function loadLatest() {
      try {
        const response = await fetch("/api/admin/daily-halacha", { cache: "no-store" });
        const payload = (await response.json()) as {
          ok: boolean;
          data?: {
            halacha_date: string;
            title: string;
            content: string;
            published: boolean;
          } | null;
          error?: string;
        };

        if (!active) return;

        if (!payload.ok) {
          setError(payload.error ?? "טעינת ההלכה נכשלה");
          return;
        }

        if (payload.data) {
          setForm({
            halachaDate: payload.data.halacha_date,
            title: payload.data.title,
            content: payload.data.content,
            published: payload.data.published
          });
        }
      } catch {
        if (!active) return;
        setError("טעינת ההלכה נכשלה");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadLatest();

    return () => {
      active = false;
    };
  }, []);

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

      setMessage("ההלכה היומית נשמרה בהצלחה.");
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
        <CardDescription>עדכון התוכן שמוצג בדף הבית.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען נתונים...</p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor="halachaDate">
                תאריך
              </label>
              <input
                id="halachaDate"
                type="date"
                value={form.halachaDate}
                onChange={(event) => setForm((prev) => ({ ...prev, halachaDate: event.target.value }))}
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
              פרסום פעיל בדף הבית
            </label>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "שומר..." : "שמור הלכה"}
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

