"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SynagogueOption = { id: string; name: string };

type Gabbai = {
  userId: string;
  email: string | null;
  displayName: string | null;
  mustChangePassword: boolean;
  synagogueIds: string[];
  createdAt: string;
};

function mapError(error?: string) {
  switch (error) {
    case "invalid_email":
      return "כתובת אימייל לא תקינה.";
    case "no_synagogues":
      return "יש לבחור לפחות בית כנסת אחד.";
    case "email_exists":
      return "כתובת האימייל כבר קיימת במערכת.";
    case "synagogue_not_found":
      return "אחד מבתי הכנסת שנבחרו לא נמצא.";
    case "forbidden":
      return "אין לך הרשאה לפעולה זו.";
    default:
      return error || "הפעולה נכשלה.";
  }
}

function TempPasswordNotice({ email, password }: { email: string; password: string }) {
  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">סיסמה זמנית נוצרה — מסרו אותה לגבאי כעת (לא תוצג שוב):</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="rounded bg-white px-2 py-1 text-base font-bold tracking-wider">{password}</code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void navigator.clipboard?.writeText(password)}
        >
          <Copy className="ml-1 h-4 w-4" />
          העתק
        </Button>
      </div>
      <p className="mt-2 text-xs">
        עבור: {email}. בכניסה הראשונה הגבאי יתבקש לבחור סיסמה חדשה.
      </p>
    </div>
  );
}

export function GabbaimManager({ synagogues }: { synagogues: SynagogueOption[] }) {
  const [gabbaim, setGabbaim] = useState<Gabbai[]>([]);
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdTemp, setCreatedTemp] = useState<{ email: string; password: string } | null>(null);
  const [resetTemp, setResetTemp] = useState<{ userId: string; password: string } | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editSelected, setEditSelected] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const nameById = useMemo(() => new Map(synagogues.map((s) => [s.id, s.name])), [synagogues]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/system/gabbaim", { cache: "no-store" });
    const payload = (await res.json()) as { ok: boolean; data?: Gabbai[]; error?: string };
    if (payload.ok) setGabbaim(payload.data ?? []);
    else setError(mapError(payload.error));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSynagogue(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function createGabbai(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCreatedTemp(null);
    setResetTemp(null);
    setCreating(true);
    const res = await fetch("/api/admin/system/gabbaim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, synagogueIds: selected })
    });
    const payload = (await res.json()) as {
      ok: boolean;
      data?: { email: string; tempPassword: string };
      error?: string;
    };
    setCreating(false);
    if (!payload.ok || !payload.data) {
      setError(mapError(payload.error));
      return;
    }
    setCreatedTemp({ email: payload.data.email, password: payload.data.tempPassword });
    setEmail("");
    setSelected([]);
    await load();
  }

  async function resetPassword(userId: string) {
    setError(null);
    setCreatedTemp(null);
    setResetTemp(null);
    const res = await fetch("/api/admin/system/gabbaim", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", userId })
    });
    const payload = (await res.json()) as { ok: boolean; data?: { tempPassword: string }; error?: string };
    if (!payload.ok || !payload.data) {
      setError(mapError(payload.error));
      return;
    }
    setResetTemp({ userId, password: payload.data.tempPassword });
    await load();
  }

  function startEditSynagogues(g: Gabbai) {
    setEditingUserId(g.userId);
    setEditSelected([...g.synagogueIds]);
    setError(null);
  }

  async function saveSynagogues(userId: string) {
    setError(null);
    setSavingEdit(true);
    const res = await fetch("/api/admin/system/gabbaim", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_synagogues", userId, synagogueIds: editSelected })
    });
    const payload = (await res.json()) as { ok: boolean; error?: string };
    setSavingEdit(false);
    if (!payload.ok) {
      setError(mapError(payload.error));
      return;
    }
    setEditingUserId(null);
    await load();
  }

  async function removeGabbai(userId: string, email: string | null) {
    if (!window.confirm(`למחוק את הגבאי ${email ?? ""}? פעולה זו אינה הפיכה.`)) return;
    setError(null);
    const res = await fetch("/api/admin/system/gabbaim", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });
    const payload = (await res.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setError(mapError(payload.error));
      return;
    }
    await load();
  }

  return (
    <Card className="mt-6 max-w-3xl">
      <CardHeader>
        <CardTitle>ניהול גבאים</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={createGabbai}>
          <label className="text-sm font-medium">אימייל הגבאי (שם המשתמש שלו)</label>
          <input
            type="email"
            className="h-10 rounded-md border border-border bg-background px-3"
            placeholder="gabbai@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="text-sm font-medium">בתי כנסת שהגבאי ינהל</label>
          {synagogues.length ? (
            <div className="grid gap-1.5 rounded-md border border-border p-3 sm:grid-cols-2">
              {synagogues.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggleSynagogue(s.id)}
                  />
                  <span>
                    {s.name} <span className="text-muted-foreground">({s.id})</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">אין בתי כנסת מוגדרים עדיין.</p>
          )}

          <div className="mt-1 flex items-center gap-3">
            <Button type="submit" disabled={creating}>
              {creating ? "יוצר…" : "צור גבאי"}
            </Button>
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </form>

        {createdTemp ? <TempPasswordNotice email={createdTemp.email} password={createdTemp.password} /> : null}

        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold">גבאים קיימים</p>
          <ul className="space-y-2">
            {gabbaim.map((g) => (
              <li key={g.userId} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{g.email}</div>
                    <div className="text-muted-foreground">
                      {g.synagogueIds.length
                        ? g.synagogueIds.map((id) => nameById.get(id) ?? id).join(", ")
                        : "לא משויך לבית כנסת"}
                    </div>
                    {g.mustChangePassword ? (
                      <div className="mt-1 text-xs text-amber-700">ממתין להחלפת סיסמה בכניסה</div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        editingUserId === g.userId ? setEditingUserId(null) : startEditSynagogues(g)
                      }
                    >
                      {editingUserId === g.userId ? "סגור שיוך" : "ערוך שיוך"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void resetPassword(g.userId)}>
                      <RefreshCw className="ml-1 h-4 w-4" />
                      אפס סיסמה
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void removeGabbai(g.userId, g.email)}
                    >
                      <Trash2 className="ml-1 h-4 w-4" />
                      מחק
                    </Button>
                  </div>
                </div>
                {editingUserId === g.userId ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {synagogues.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editSelected.includes(s.id)}
                            onChange={() =>
                              setEditSelected((prev) =>
                                prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                              )
                            }
                          />
                          <span>{s.name}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingEdit}
                        onClick={() => void saveSynagogues(g.userId)}
                      >
                        {savingEdit ? "שומר…" : "שמור שיוך"}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {resetTemp && resetTemp.userId === g.userId ? (
                  <TempPasswordNotice email={g.email ?? ""} password={resetTemp.password} />
                ) : null}
              </li>
            ))}
            {!gabbaim.length ? <li className="text-sm text-muted-foreground">אין עדיין גבאים.</li> : null}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
