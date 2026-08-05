"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/ssr-client";

type Mode = "login" | "forgot";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";
  const urlError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError === "recovery_failed" ? "קישור איפוס הסיסמה אינו תקף או שפג תוקפו. נסו שוב." : null
  );
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (signInError) {
      setLoading(false);
      setError("אימייל או סיסמה שגויים. נסו שוב.");
      return;
    }
    // רענון מלא כדי שה-middleware יזהה את הסשן ויפנה כנדרש (כולל החלפת סיסמה ראשונה).
    window.location.assign(next);
  }

  async function onForgot(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      "/admin/change-password?recovery=1"
    )}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo
    });
    setLoading(false);
    if (resetError) {
      setError("שליחת מייל האיפוס נכשלה. נסו שוב מאוחר יותר.");
      return;
    }
    // הודעה אחידה גם אם האימייל לא קיים — כדי לא לחשוף קיום חשבונות.
    setInfo("אם קיים חשבון עם אימייל זה, נשלח אליו קישור לאיפוס סיסמה. בדקו גם בספאם.");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{mode === "login" ? "כניסה לממשק הניהול" : "איפוס סיסמה"}</CardTitle>
      </CardHeader>
      <CardContent>
        {mode === "login" ? (
          <form className="grid gap-3" onSubmit={onLogin}>
            <label className="text-sm font-medium">אימייל</label>
            <input
              type="email"
              autoComplete="username"
              className="h-10 rounded-md border border-border bg-background px-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="text-sm font-medium">סיסמה</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="h-10 w-full rounded-md border border-border bg-background px-3 pe-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                title={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? "מתחבר…" : "כניסה"}
            </Button>
            <button
              type="button"
              className="mt-1 text-sm text-primary underline"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setInfo(null);
              }}
            >
              שכחתי סיסמה
            </button>
          </form>
        ) : (
          <form className="grid gap-3" onSubmit={onForgot}>
            <p className="text-sm text-muted-foreground">
              הזינו את האימייל שלכם ונשלח קישור לבחירת סיסמה חדשה.
            </p>
            <label className="text-sm font-medium">אימייל</label>
            <input
              type="email"
              autoComplete="username"
              className="h-10 rounded-md border border-border bg-background px-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {info ? <p className="text-sm text-green-700">{info}</p> : null}
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? "שולח…" : "שלח קישור לאיפוס"}
            </Button>
            <button
              type="button"
              className="mt-1 text-sm text-primary underline"
              onClick={() => {
                setMode("login");
                setError(null);
                setInfo(null);
              }}
            >
              חזרה להתחברות
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="container flex min-h-[70vh] items-center justify-center py-10">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
