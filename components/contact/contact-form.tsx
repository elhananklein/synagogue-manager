"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function mapError(error?: string) {
  switch (error) {
    case "message_required":
      return "יש לכתוב הודעה לפני השליחה.";
    case "invalid_email":
      return "כתובת האימייל אינה תקינה.";
    case "mail_not_configured":
      return "שליחת מייל אינה מוגדרת כרגע בשרת. נסו להתקשר או לשלוח מייל ישירות.";
    case "send_failed":
      return "שליחת ההודעה נכשלה. נסו שוב מאוחר יותר.";
    default:
      return "שליחת ההודעה נכשלה. נסו שוב.";
  }
}

export function ContactForm({ className }: { className?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(false);
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message, website })
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!payload.ok) {
        setError(mapError(payload.error));
        return;
      }
      setSent(true);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch {
      setError(mapError());
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-3", className)}>
      <p className="text-sm text-muted-foreground">
        אפשר לשלוח הודעה כאן. שם, אימייל וטלפון אינם חובה — גם פרגון קצר מתקבל בברכה.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">שם</label>
          <input
            className="h-10 w-full rounded-md border border-border bg-background px-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={200}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">אימייל</label>
          <input
            type="email"
            className="h-10 w-full rounded-md border border-border bg-background px-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={200}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">טלפון</label>
          <input
            type="tel"
            className="h-10 w-full rounded-md border border-border bg-background px-3"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            maxLength={200}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">הודעה</label>
        <textarea
          className="min-h-[140px] w-full resize-y rounded-md border border-border bg-background px-3 py-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={4000}
          placeholder="כתבו כאן את הפנייה…"
        />
      </div>

      {/* honeypot מוסתר ממשתמשים */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {sent ? <p className="text-sm text-green-700">ההודעה נשלחה בהצלחה. תודה!</p> : null}

      <Button type="submit" disabled={loading}>
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            שולח…
          </span>
        ) : (
          "שלח"
        )}
      </Button>
    </form>
  );
}
