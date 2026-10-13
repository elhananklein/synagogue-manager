"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Copy, FileDown, FileSpreadsheet, FileUp, LayoutList, Loader2, Plus, Printer, Search, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CongregantThemeFrame } from "@/components/admin/congregant-theme-frame";
import { mapCongregantApiError } from "@/lib/congregant-errors";
import {
  CONGREGANT_TRIBE_LABELS,
  congregantDisplayName,
  congregantJoinPath,
  congregantPrayerName,
  type CongregantInput,
  type CongregantMinyanOption,
  type CongregantRecord
} from "@/lib/congregant-types";
import type { CongregantImportIssue } from "@/lib/congregant-excel";
import { buildRoster, filterRoster, rosterQueryString, type RosterFilter } from "@/lib/congregant-roster";

export function CongregantsManager({
  synagogueId,
  initialCongregants,
  minyanim
}: {
  synagogueId: string;
  initialCongregants: CongregantRecord[];
  minyanim: CongregantMinyanOption[];
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [congregants, setCongregants] = useState(initialCongregants);
  const [minyanFilter, setMinyanFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Array<{ line: number; input: CongregantInput; minyanName: string }> | null>(
    null
  );
  const [issues, setIssues] = useState<CongregantImportIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [copying, setCopying] = useState(false);
  const selectedMinyan = minyanim.find((item) => item.id === minyanFilter) ?? minyanim[0] ?? null;
  const base = `/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants`;
  const joinHref = congregantJoinPath(synagogueId, minyanFilter || null);

  const [view, setView] = useState<"cards" | "table">("cards");
  const [exporting, setExporting] = useState(false);
  const rosterFilter: RosterFilter = useMemo(
    () => ({ minyanId: minyanFilter || null, includeInactive: showInactive, query }),
    [minyanFilter, showInactive, query]
  );
  const visible = useMemo(() => filterRoster(congregants, rosterFilter), [congregants, rosterFilter]);
  const roster = useMemo(
    () => (view === "table" ? buildRoster(congregants, rosterFilter) : null),
    [view, congregants, rosterFilter]
  );
  const exportBase = `/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants/export`;

  async function exportExcel() {
    setExporting(true);
    setError(null);
    try {
      const response = await fetch(`${exportBase}?${rosterQueryString(rosterFilter)}`, { cache: "no-store" });
      if (!response.ok) {
        setError("הייצוא לאקסל נכשל");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "רשימת מתפללים.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("הייצוא לאקסל נכשל");
    } finally {
      setExporting(false);
    }
  }

  function openPrint() {
    const qs = rosterQueryString(rosterFilter);
    window.open(`${exportBase}?format=print${qs ? `&${qs}` : ""}`, "_blank", "noopener");
  }

  const pending = visible.filter((row) => row.registrationStatus === "pending");
  const approved = visible.filter((row) => row.registrationStatus !== "pending");

  async function copyJoinLink() {
    const url = `${window.location.origin}${joinHref}`;
    setCopying(true);
    setError(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: "הרשמה לבית הכנסת", url });
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("קישור ההרשמה הועתק");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setMessage("קישור ההרשמה הועתק");
      } catch {
        setError("לא הצלחנו להעתיק את הקישור");
      }
    } finally {
      setCopying(false);
    }
  }

  async function patchStatus(id: string, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm("לדחות ולמחוק את הבקשה?")) return;
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action })
        }
      );
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(mapCongregantApiError(payload.error));
        return;
      }
      if (action === "reject") {
        setCongregants((rows) => rows.filter((row) => row.id !== id));
        setMessage("הבקשה נדחתה");
      } else {
        setCongregants((rows) =>
          rows.map((row) => (row.id === id ? { ...row, registrationStatus: "approved" as const } : row))
        );
        setMessage("המתפלל אושר");
      }
    } catch {
      setError("הפעולה נכשלה");
    }
  }

  async function downloadTemplate() {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants/template`);
      if (!response.ok) {
        setError("הורדת התבנית נכשלה");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "congregants-template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("הורדת התבנית נכשלה");
    } finally {
      setDownloading(false);
    }
  }

  async function onFile(file: File) {
    setParsing(true);
    setError(null);
    setMessage(null);
    setPreview(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants/import`, {
        method: "POST",
        body
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        rows?: Array<{ line: number; input: CongregantInput; minyanName: string }>;
        issues?: CongregantImportIssue[];
      };
      if (!payload.ok && !payload.rows) {
        setError(mapCongregantApiError(payload.error));
        setIssues(payload.issues ?? []);
        return;
      }
      setPreview(payload.rows ?? []);
      setIssues(payload.issues ?? []);
      if (!(payload.rows ?? []).length) setError("לא נמצאו שורות תקינות לייבוא");
    } catch {
      setError("קריאת הקובץ נכשלה");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!preview?.length) return;
    setImporting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: preview.map((row) => row.input) })
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        inserted?: number;
        issues?: CongregantImportIssue[];
      };
      if (!payload.ok) {
        setError(mapCongregantApiError(payload.error));
        setIssues(payload.issues ?? []);
        return;
      }
      setMessage(`יובאו ${payload.inserted ?? preview.length} מתפללים`);
      setPreview(null);
      setIssues(payload.issues ?? []);
      const reload = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants`, { cache: "no-store" });
      const next = (await reload.json()) as { ok: boolean; data?: { congregants: CongregantRecord[] } };
      if (next.ok && next.data) setCongregants(next.data.congregants);
    } catch {
      setError("הייבוא נכשל");
    } finally {
      setImporting(false);
    }
  }

  return (
    <CongregantThemeFrame minyan={selectedMinyan}>
      <div className="congregant-toolbar">
        <label className="congregant-field" style={{ flex: "1 1 12rem" }}>
          <span className="sr-only">חיפוש</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם או טלפון"
              style={{ paddingInlineStart: "2.2rem" }}
            />
          </span>
        </label>
        {minyanim.length > 1 ? (
          <label className="congregant-field" style={{ flex: "1 1 10rem" }}>
            <span className="sr-only">סינון מניין</span>
            <select value={minyanFilter} onChange={(e) => setMinyanFilter(e.target.value)}>
              <option value="">כל המניינים</option>
              {minyanim.map((minyan) => (
                <option key={minyan.id} value={minyan.id}>
                  {minyan.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <label className="congregant-check" style={{ marginBottom: "0.85rem" }}>
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        להציג גם מי שאינם פעילים
      </label>

      <div className="congregant-link-box">
        <span>קישור למתפללים שימלאו בעצמם:</span>
        <code>{joinHref}</code>
        <Button type="button" variant="outline" size="sm" onClick={() => void copyJoinLink()} disabled={copying}>
          <Copy className="ml-1 h-4 w-4" />
          {copying ? "…" : "העתקת קישור"}
        </Button>
      </div>

      <div className="congregant-toolbar">
        <Button asChild>
          <Link href={`${base}/new${minyanFilter ? `?minyanId=${encodeURIComponent(minyanFilter)}` : ""}`}>
            <Plus className="ml-1 h-4 w-4" />
            מתפלל חדש
          </Link>
        </Button>
        <Button type="button" variant="outline" onClick={() => void downloadTemplate()} disabled={downloading}>
          {downloading ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <FileDown className="ml-1 h-4 w-4" />}
          הורדת תבנית אקסל
        </Button>
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing}>
          {parsing ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <FileUp className="ml-1 h-4 w-4" />}
          ייבוא מאקסל
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </div>

      <div className="congregant-toolbar congregant-view-bar">
        <div className="congregant-view-toggle" role="group" aria-label="תצוגת הרשימה">
          <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")}>
            <LayoutList className="h-4 w-4" />
            כרטיסים
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            <Table2 className="h-4 w-4" />
            טבלה
          </button>
        </div>
        <Button type="button" variant="outline" onClick={() => void exportExcel()} disabled={exporting || !visible.length}>
          {exporting ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="ml-1 h-4 w-4" />}
          ייצוא לאקסל
        </Button>
        <Button type="button" variant="outline" onClick={openPrint} disabled={!visible.length}>
          <Printer className="ml-1 h-4 w-4" />
          הדפסה / PDF
        </Button>
      </div>

      {message ? <p className="gabbai-ok mb-3">{message}</p> : null}
      {error ? <p className="gabbai-err mb-3">{error}</p> : null}

      {preview ? (
        <div className="congregant-card" style={{ marginBottom: "1rem" }}>
          <div className="congregant-card-head">
            <div>
              <h2>תצוגה לפני ייבוא</h2>
              <p>
                {preview.length} שורות תקינות
                {issues.length ? ` · ${issues.length} שורות עם שגיאה לא ייובאו` : ""}
              </p>
            </div>
          </div>
          <div className="congregant-card-body">
            <ul className="congregant-list">
              {preview.slice(0, 12).map((row) => (
                <li key={row.line}>
                  {congregantDisplayName(row.input)}
                  {row.minyanName ? ` · ${row.minyanName}` : ""}
                </li>
              ))}
            </ul>
            {preview.length > 12 ? <p className="mt-2 text-sm">ועוד {preview.length - 12}…</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => void confirmImport()} disabled={importing}>
                {importing ? "מייבא…" : `אישור ייבוא (${preview.length})`}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={importing}>
                ביטול
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {issues.length ? (
        <div className="congregant-issues">
          שורות שלא ייובאו:
          <ul>
            {issues.slice(0, 20).map((issue) => (
              <li key={`${issue.line}-${issue.message}`}>
                שורה {issue.line}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="congregant-empty">אין עדיין מתפללים ברשימה. הוסיפו אחד, ייבאו מאקסל, או שלחו את קישור ההרשמה.</p>
      ) : roster ? (
        <div className="congregant-table-wrap">
          <p className="congregant-table-count">
            {roster.rows.length} מתפללים · לפי א-ב של שם המשפחה
          </p>
          <div className="congregant-table-scroll">
            <table className="congregant-table">
              <thead>
                <tr>
                  {roster.columns.map((col) => (
                    <th key={col.key}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.rows.map((row) => (
                  <tr key={row.id} className={row.status ? "is-flagged" : undefined}>
                    {roster.columns.map((col) => (
                      <td key={col.key} className={col.key === "lastName" ? "is-last" : undefined}>
                        {col.key === "lastName" || col.key === "firstName" ? (
                          <Link href={`${base}/${row.id}`}>{row[col.key] || "—"}</Link>
                        ) : col.key === "phone" && row.phone ? (
                          <a href={`tel:${row.phone}`} dir="ltr">
                            {row.phone}
                          </a>
                        ) : (
                          row[col.key]
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {pending.length ? (
            <div className="congregant-list" style={{ marginBottom: "1rem" }}>
              <p className="mb-2 text-sm font-extrabold" style={{ color: "var(--c-muted)" }}>
                ממתינים לאישור ({pending.length})
              </p>
              {pending.map((row) => (
                <div key={row.id} className="congregant-row-wrap">
                  <Link href={`${base}/${row.id}`} className="congregant-row">
                    <span>
                      <h3>{congregantDisplayName(row)}</h3>
                      <p>
                        {congregantPrayerName(row)}
                        {row.minyanName ? ` · ${row.minyanName}` : ""}
                        {row.phone ? ` · ${row.phone}` : ""}
                      </p>
                    </span>
                    <span className="congregant-badge congregant-badge--pending">ממתין</span>
                  </Link>
                  <div className="congregant-row-actions">
                    <Button type="button" size="sm" onClick={() => void patchStatus(row.id, "approve")}>
                      אישור
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void patchStatus(row.id, "reject")}>
                      דחייה
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {approved.length ? (
            <div className="congregant-list">
              {approved.map((row) => (
                <Link key={row.id} href={`${base}/${row.id}`} className="congregant-row">
                  <span>
                    <h3>{congregantDisplayName(row)}</h3>
                    <p>
                      {congregantPrayerName(row)}
                      {row.minyanName ? ` · ${row.minyanName}` : ""}
                      {row.phone ? ` · ${row.phone}` : ""}
                    </p>
                  </span>
                  <span className="congregant-badges">
                    {row.messagesConsent ? (
                      <span className="congregant-badge congregant-badge--consent" title="אישר לקבל הודעות">
                        הודעות
                      </span>
                    ) : null}
                    <span className="congregant-badge">{CONGREGANT_TRIBE_LABELS[row.tribe]}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </>
      )}
    </CongregantThemeFrame>
  );
}
