"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GabbaiSaveBar } from "@/components/admin/gabbai-save-bar";
import {
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
  type PushMessageRecord,
  type PushTemplate
} from "@/lib/push-types";
import type { CongregantMinyanOption } from "@/lib/congregant-types";

type PanelData = {
  enabled: boolean;
  vapidReady: boolean;
  subscriberCount: number;
  tablesReady: boolean;
  missingTables: boolean;
  messages: PushMessageRecord[];
  minyanim: CongregantMinyanOption[];
  templates: PushTemplate[];
};

function statusLabel(status: PushMessageRecord["status"]) {
  if (status === "sent") return "נשלח";
  if (status === "scheduled") return "מתוזמן";
  if (status === "sending") return "נשלח כעת";
  if (status === "cancelled") return "בוטל";
  if (status === "failed") return "נכשל";
  return status;
}

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem"
  }).format(date);
}

export default function PushMessagesPanel({ synagogueId }: { synagogueId: string }) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [minyanId, setMinyanId] = useState("");
  const [mode, setMode] = useState<"now" | "later">("now");
  const [scheduledLocal, setScheduledLocal] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/push`, {
        cache: "no-store"
      });
      const payload = (await res.json()) as { ok: boolean; error?: string; data?: PanelData };
      if (!payload.ok || !payload.data) {
        setError(
          payload.error === "push_not_enabled"
            ? "התראות לא פעילות לבית הכנסת הזה."
            : payload.error === "missing_push_tables"
              ? "חסרות טבלאות. הריצו supabase/push-notifications-migration.sql"
              : "טעינת ההתראות נכשלה."
        );
        setData(null);
        return;
      }
      setData(payload.data);
    } catch {
      setError("טעינת ההתראות נכשלה.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [synagogueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const templates = data?.templates ?? [];
  const minyanNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of data?.minyanim ?? []) map.set(item.id, item.name);
    return map;
  }, [data?.minyanim]);

  function applyTemplate(key: string) {
    setTemplateKey(key);
    const found = templates.find((item) => item.key === key);
    if (!found) return;
    setTitle(found.title);
    setBody(found.body);
  }

  async function send() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const scheduledFor =
        mode === "later" && scheduledLocal.trim()
          ? new Date(scheduledLocal).toISOString()
          : null;
      const res = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          templateKey: templateKey || null,
          minyanId: minyanId || null,
          sendNow: mode === "now",
          scheduledFor
        })
      });
      const payload = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { delivered?: boolean; successCount?: number; failCount?: number };
      };
      if (!payload.ok) {
        const map: Record<string, string> = {
          invalid_title: "כותרת חסרה או ארוכה מדי",
          invalid_body: "תוכן חסר או ארוך מדי",
          invalid_schedule: "תאריך/שעה לא תקינים",
          schedule_in_past: "אי אפשר לתזמן לעבר",
          missing_vapid: "חסרים מפתחות VAPID בסביבה",
          missing_push_tables: "חסרות טבלאות. הריצו את מיגרציית ההתראות"
        };
        setError(map[payload.error ?? ""] || payload.error || "השליחה נכשלה");
        return;
      }
      if (mode === "later") setMessage("ההודעה תוזמנה. תישלח במועד שנבחר.");
      else {
        setMessage(
          `נשלח. הצלחות: ${payload.data?.successCount ?? 0}, כשלונות: ${payload.data?.failCount ?? 0}`
        );
      }
      setTitle("");
      setBody("");
      setTemplateKey("");
      await load();
    } catch {
      setError("השליחה נכשלה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(messageId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/gabbai/${encodeURIComponent(synagogueId)}/push?messageId=${encodeURIComponent(messageId)}`,
        { method: "DELETE" }
      );
      const payload = (await res.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError("ביטול התזמון נכשל.");
        return;
      }
      setMessage("התזמון בוטל.");
      await load();
    } catch {
      setError("ביטול התזמון נכשל.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="gabbai-hint inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        טוען…
      </p>
    );
  }

  if (!data) {
    return <p className="gabbai-err">{error || "אין נתונים."}</p>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Bell className="h-5 w-5" aria-hidden />
          <h2 className="text-base font-extrabold">התראה למתפללים</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          נשלח למי שהתקין את האפליקציה ואישר התראות
          {data.minyanim.length > 1 ? " (אפשר לסנן לפי מניין)" : ""}.
        </p>
        <p className="mb-3 text-sm font-bold">
          מנויים פעילים: {data.subscriberCount}
          {!data.vapidReady ? " · חסרים מפתחות VAPID" : ""}
        </p>
        {data.missingTables ? (
          <p className="gabbai-err mb-3">
            חסרות טבלאות במסד. הריצו ב-Supabase את הקובץ supabase/push-notifications-migration.sql
          </p>
        ) : null}

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium">תבנית מוכנה (לא חובה)</span>
          <select
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            value={templateKey}
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="">בלי תבנית — כתיבה חופשית</option>
            {templates.map((item) => (
              <option key={item.key} value={item.key}>
                {item.title}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium">כותרת</span>
          <input
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            maxLength={PUSH_TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="למשל: שינוי בשעת מנחה"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium">תוכן ההודעה</span>
          <textarea
            className="min-h-[7rem] w-full rounded-md border border-border bg-background p-3 leading-relaxed"
            maxLength={PUSH_BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="הטקסט שיופיע בהתראה ובדף הייעודי"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {body.length}/{PUSH_BODY_MAX}
          </span>
        </label>

        {data.minyanim.length > 1 ? (
          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium">למי לשלוח</span>
            <select
              className="h-11 w-full rounded-md border border-border bg-background px-3"
              value={minyanId}
              onChange={(e) => setMinyanId(e.target.value)}
            >
              <option value="">כל בית הכנסת</option>
              {data.minyanim.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <fieldset className="mb-3 space-y-2">
          <legend className="mb-1 text-sm font-medium">מתי לשלוח</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode === "now"} onChange={() => setMode("now")} />
            עכשיו
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode === "later"} onChange={() => setMode("later")} />
            במועד מאוחר יותר
          </label>
          {mode === "later" ? (
            <input
              type="datetime-local"
              className="h-11 w-full max-w-sm rounded-md border border-border bg-background px-3"
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
            />
          ) : null}
        </fieldset>

        <GabbaiSaveBar
          label={mode === "now" ? "שליחת התראה" : "תזמון התראה"}
          saving={saving}
          message={message}
          error={error}
          onSave={() => void send()}
        />
        <p className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1">
          <Send className="h-3.5 w-3.5" aria-hidden />
          לחיצה על ההתראה בטלפון פותחת דף עם תוכן ההודעה.
        </p>
        {mode === "later" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            תזמון: ההודעה תישלח כשפותחים את המסך הזה אחרי המועד, או ברצת הבוקר היומית בשרת. לשליחה מדויקת לפי השעה — אפשר לשלוח «עכשיו».
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="mb-3 text-base font-extrabold">היסטוריה</h2>
        {!data.messages.length ? (
          <p className="text-sm text-muted-foreground">עדיין לא נשלחו הודעות.</p>
        ) : (
          <ul className="space-y-3">
            {data.messages.map((row) => (
              <li key={row.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold">{row.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{row.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {statusLabel(row.status)}
                      {row.minyanId ? ` · ${minyanNameById.get(row.minyanId) || "מניין"}` : " · כל בית הכנסת"}
                      {row.scheduledFor ? ` · ${formatWhen(row.scheduledFor)}` : ""}
                      {row.status === "sent"
                        ? ` · ${row.successCount} הצלחות / ${row.failCount} כשלונות`
                        : ""}
                    </p>
                  </div>
                  {row.status === "scheduled" ? (
                    <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void cancel(row.id)}>
                      ביטול תזמון
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
