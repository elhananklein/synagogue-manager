"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoCacheVersion, synagogueIconSrc } from "@/lib/synagogue-logo";

function mapLogoError(error?: string) {
  if (error === "invalid_file_type") return "יש להעלות קובץ PNG, JPG או WebP.";
  if (error === "file_too_large") return "הקובץ גדול מדי (עד 5MB).";
  if (error === "logo_process_failed") return "לא הצלחנו לעבד את התמונה. נסו קובץ אחר.";
  if (error === "logo_column_missing") return "חסר עדכון במסד הנתונים (עמודת לוגו). הריצו את המיגרציה synagogue-logo-migration.sql.";
  return error ?? "ההעלאה נכשלה. נסו שוב.";
}

export function SynagogueLogoField({
  synagogueId,
  logoUrl,
  logoUpdatedAt,
  onChanged
}: {
  synagogueId: string;
  logoUrl: string | null;
  logoUpdatedAt: string | null;
  onChanged: (next: { logoUrl: string | null; logoUpdatedAt: string | null }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = logoCacheVersion(logoUpdatedAt);
  const preview = logoUrl ? synagogueIconSrc(synagogueId, "192", version) : null;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/logo`, {
        method: "POST",
        body
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        logoUrl?: string | null;
        logoUpdatedAt?: string | null;
      };
      if (!payload.ok) {
        setError(mapLogoError(payload.error));
        return;
      }
      onChanged({
        logoUrl: payload.logoUrl ?? null,
        logoUpdatedAt: payload.logoUpdatedAt ?? null
      });
    } catch {
      setError("ההעלאה נכשלה. נסו שוב.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/logo`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(mapLogoError(payload.error));
        return;
      }
      onChanged({ logoUrl: null, logoUpdatedAt: null });
    } catch {
      setError("לא הצלחנו להסיר את הלוגו. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-base font-extrabold">לוגו בית הכנסת</h2>
      <p className="gabbai-hint mb-3">
        הלוגו יופיע כאייקון האפליקציה בשולחן העבודה אצל מי שמתקין מהקישור של בית הכנסת.
        אחרי שינוי לוגו, מי שכבר התקין צריך להסיר את האפליקציה ולהתקין מחדש.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="gabbai-logo-preview" aria-hidden={!preview}>
          {preview ? (
            <img src={preview} alt="לוגו בית הכנסת" />
          ) : (
            <ImagePlus className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? "מעלה…" : logoUrl ? "החלפת לוגו" : "העלאת לוגו"}
            </Button>
            {logoUrl ? (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove()}>
                הסרת לוגו
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG או WebP, עד 5MB. עדיף תמונה מרובעת.</p>
        </div>
      </div>
      {error ? <p className="gabbai-err mt-2">{error}</p> : null}
    </section>
  );
}
