"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParashaPrayerCatalogRow, ParashaPrayerParseWarning } from "@/lib/parasha-prayer-catalog";
import { parashaPairParts, withParashaCatalogSelectKeys } from "@/lib/parasha-prayer-catalog";

type EditorRow = ParashaPrayerCatalogRow & { clientId: string };

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toEditorRows(rows: ParashaPrayerCatalogRow[]): EditorRow[] {
  return rows.map((row) => ({ ...row, clientId: newId() }));
}

export function ParashaPrayerCatalogEditor({
  synagogueId,
  minyanId,
  parashaKeys,
  savedRows
}: {
  synagogueId: string;
  minyanId?: string;
  parashaKeys: string[];
  savedRows: ParashaPrayerCatalogRow[];
}) {
  const allowedKeys = useMemo(() => withParashaCatalogSelectKeys(parashaKeys), [parashaKeys]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<EditorRow[]>(() => toEditorRows(savedRows));
  const [warnings, setWarnings] = useState<ParashaPrayerParseWarning[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  useEffect(() => {
    setRows(toEditorRows(savedRows));
    setWarnings([]);
    setNeedsConfirm(false);
    setMessage(null);
    setError(null);
  }, [minyanId, savedRows]);

  const usedKeys = new Set(rows.map((row) => row.parashaKey).filter(Boolean));

  function addRow() {
    const nextKey =
      allowedKeys.find((key) => !usedKeys.has(key) && !parashaPairParts(key)) ??
      allowedKeys.find((key) => !usedKeys.has(key)) ??
      "";
    setRows((current) => [
      ...current,
      { clientId: newId(), parashaKey: nextKey, minchaTime: null, maarivTime: null }
    ]);
    setNeedsConfirm(true);
    setMessage(null);
  }

  async function downloadTemplate() {
    setError(null);
    setMessage(null);
    setIsDownloadingTemplate(true);
    try {
      const response = await fetch(`/api/admin/gabbai/${synagogueId}/parasha-catalog/template`, {
        cache: "no-store"
      });
      if (!response.ok) {
        setError("הורדת התבנית נכשלה");
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const named = /filename="([^"]+)"/.exec(disposition);
      const filename = named?.[1] || "parasha-prayer-times.csv";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("הורדת התבנית נכשלה");
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  async function onFile(file: File) {
    setError(null);
    setMessage(null);
    setIsParsing(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/admin/gabbai/${synagogueId}/parasha-catalog/parse`, {
        method: "POST",
        body
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        rows?: ParashaPrayerCatalogRow[];
        warnings?: ParashaPrayerParseWarning[];
      };
      if (!payload.ok) {
        setError(
          payload.error === "invalid_file_type"
            ? "יש להעלות קובץ Excel או CSV"
            : payload.error === "file_too_large"
              ? "הקובץ גדול מדי"
              : "קריאת הקובץ נכשלה"
        );
        return;
      }
      setRows(toEditorRows(payload.rows ?? []));
      setWarnings(payload.warnings ?? []);
      setNeedsConfirm(true);
      setMessage("הקובץ נקרא. בדקו את הטבלה ולחצו «אישור ושמירה» כדי להחליף את הקטלוג.");
    } catch {
      setError("קריאת הקובץ נכשלה");
    } finally {
      setIsParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveCatalog() {
    if (!minyanId) return;
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/gabbai/${synagogueId}/parasha-catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minyanId,
          rows: rows.map(({ parashaKey, minchaTime, maarivTime }) => ({
            parashaKey,
            minchaTime,
            maarivTime
          }))
        })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(
          payload.error === "unknown_parasha"
            ? "יש לבחור פרשה מהרשימה הסגורה בכל השורות"
            : payload.error === "minyan_not_found"
              ? "יש לשמור את המניין לפני שמירת הקטלוג"
              : "שמירת הקטלוג נכשלה"
        );
        return;
      }
      setNeedsConfirm(false);
      setWarnings([]);
      setMessage("הקטלוג נשמר. מנחה וערבית במצב «לפי פרשה» ישתמשו בו אחרי בחירת «קטלוג שנתי».");
    } catch {
      setError("שמירת הקטלוג נכשלה");
    } finally {
      setIsSaving(false);
    }
  }

  if (!minyanId) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        שמרו את המניין תחילה, ואז אפשר למלא או להעלות קטלוג מנחה וערבית לפי פרשה.
      </div>
    );
  }

  return (
    <div className="relative space-y-3 rounded-md border border-border p-4">
      {isDownloadingTemplate ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-background/85 px-4 py-8"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-medium">מכין את קובץ התבנית…</p>
          <div
            className="relative h-1.5 w-48 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="מכין תבנית"
          >
            <div className="gabbai-loading-bar absolute inset-y-0 w-1/3 rounded-full bg-primary" />
          </div>
        </div>
      ) : null}
      <div>
        <h3 className="text-sm font-semibold">מנחה וערבית לפי פרשה</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          ממלאים את 54 הפרשות (וחול המועד). אין צורך בקטלוג נפרד לכל שנה: בשבוע של פרשות מחוברות נלקחת שעת
          הפרשה הראשונה בזוג, ואם אין — השנייה. שורה של הזוג עצמו (למשל מטות־מסעי) דורסת את זה לאותו זיווג.
          השמירה מחליפה את כל הקטלוג של המניין. תא ריק חוזר לכלל הרגיל של התפילה.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          הוספת שורה
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDownloadingTemplate}
          onClick={() => void downloadTemplate()}
        >
          {isDownloadingTemplate ? "מכין תבנית…" : "הורדת תבנית CSV"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isParsing}
          onClick={() => fileRef.current?.click()}
        >
          {isParsing ? "קורא קובץ…" : "העלאת Excel / CSV"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
        <Button type="button" size="sm" disabled={isSaving} onClick={() => void saveCatalog()}>
          {isSaving ? "שומר…" : "אישור ושמירה"}
        </Button>
      </div>

      {needsConfirm ? (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          הטבלה עדיין לא נשמרה במסד. לחצו «אישור ושמירה» כדי להחליף את הקטלוג.
        </p>
      ) : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {warnings.length ? (
        <ul className="list-disc space-y-1 pr-5 text-xs text-muted-foreground">
          {warnings.map((warning) => (
            <li key={`${warning.line}-${warning.message}`}>
              שורה {warning.line}: {warning.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-right">
              <th className="pb-2 font-medium">פרשה</th>
              <th className="pb-2 font-medium">מנחה</th>
              <th className="pb-2 font-medium">ערבית</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-muted-foreground">
                  אין שורות. הוסיפו שורה או העלו קובץ.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.clientId} className="border-b border-border/70">
                  <td className="py-2 pe-2">
                    <select
                      className="h-10 w-full min-w-[12rem] rounded-md border border-border bg-background px-2"
                      value={row.parashaKey}
                      onChange={(e) => {
                        setRows((current) =>
                          current.map((item) =>
                            item.clientId === row.clientId ? { ...item, parashaKey: e.target.value } : item
                          )
                        );
                        setNeedsConfirm(true);
                      }}
                    >
                      <option value="">בחרו פרשה…</option>
                      {allowedKeys.map((key) => (
                        <option key={key} value={key} disabled={usedKeys.has(key) && key !== row.parashaKey}>
                          {key}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pe-2">
                    <input
                      type="time"
                      className="h-10 rounded-md border border-border bg-background px-2"
                      value={row.minchaTime ?? ""}
                      onChange={(e) => {
                        setRows((current) =>
                          current.map((item) =>
                            item.clientId === row.clientId
                              ? { ...item, minchaTime: e.target.value || null }
                              : item
                          )
                        );
                        setNeedsConfirm(true);
                      }}
                    />
                  </td>
                  <td className="py-2 pe-2">
                    <input
                      type="time"
                      className="h-10 rounded-md border border-border bg-background px-2"
                      value={row.maarivTime ?? ""}
                      onChange={(e) => {
                        setRows((current) =>
                          current.map((item) =>
                            item.clientId === row.clientId
                              ? { ...item, maarivTime: e.target.value || null }
                              : item
                          )
                        );
                        setNeedsConfirm(true);
                      }}
                    />
                  </td>
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRows((current) => current.filter((item) => item.clientId !== row.clientId));
                        setNeedsConfirm(true);
                      }}
                    >
                      מחק
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
