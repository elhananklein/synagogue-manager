"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/admin/logout-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/ssr-client";

const MIN_LENGTH = 8;

function validatePassword(pw: string): string | null {
  if (pw.length < MIN_LENGTH) return `הסיסמה חייבת להכיל לפחות ${MIN_LENGTH} תווים.`;
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "הסיסמה חייבת לכלול אותיות וגם ספרות.";
  return null;
}

function ChangePasswordForm() {
  const searchParams = useSearchParams();
  const isRecovery = searchParams.get("recovery") === "1";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError("עדכון הסיסמה נכשל. נסו שוב.");
      return;
    }

    // מסמנים בשרת שהסיסמה הוחלפה (מבטל את דגל חובת ההחלפה, אם היה).
    const res = await fetch("/api/admin/account/complete-password-change", { method: "POST" });
    if (!res.ok) {
      setLoading(false);
      setError("אירעה שגיאה בסיום התהליך. נסו להתחבר מחדש.");
      return;
    }

    // מרעננים את הסשן כדי לקבל טוקן חדש בלי דגל החלפה, ואז ממשיכים לניהול.
    await supabase.auth.refreshSession();
    window.location.assign("/admin");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isRecovery ? "איפוס סיסמה" : "בחירת סיסמה חדשה"}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {isRecovery
            ? "בחרו סיסמה חדשה לחשבון. אחרי השמירה תועברו לממשק הניהול."
            : "זו הכניסה הראשונה שלכם (או שהסיסמה אופסה). יש לבחור סיסמה חדשה כדי להמשיך."}
        </p>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="text-sm font-medium">סיסמה חדשה</label>
          <input
            type="password"
            autoComplete="new-password"
            className="h-10 rounded-md border border-border bg-background px-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="text-sm font-medium">אימות סיסמה</label>
          <input
            type="password"
            autoComplete="new-password"
            className="h-10 rounded-md border border-border bg-background px-3"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "שומר…" : "שמור סיסמה והמשך"}
          </Button>
        </form>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ChangePasswordPage() {
  return (
    <main className="container flex min-h-[70vh] items-center justify-center py-10">
      <Suspense fallback={null}>
        <ChangePasswordForm />
      </Suspense>
    </main>
  );
}
