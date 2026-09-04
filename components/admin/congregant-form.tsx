"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CongregantThemeFrame } from "@/components/admin/congregant-theme-frame";
import { CongregantFields } from "@/components/congregant/congregant-fields";
import { mapCongregantApiError } from "@/lib/congregant-errors";
import {
  applyBirthConversion,
  type BirthDateSource,
  type CongregantInput,
  type CongregantMinyanOption
} from "@/lib/congregant-types";

export function CongregantForm({
  synagogueId,
  minyanim,
  initial,
  congregantId
}: {
  synagogueId: string;
  minyanim: CongregantMinyanOption[];
  initial: CongregantInput;
  congregantId?: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState<CongregantInput>(initial);
  const [birthSource, setBirthSource] = useState<BirthDateSource>(
    initial.gregorianBirthDate ? "gregorian" : "hebrew"
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMinyan = minyanim.find((item) => item.id === input.minyanId) ?? minyanim[0] ?? null;
  const listHref = `/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants`;
  const pending = input.registrationStatus === "pending";

  function patch(next: Partial<CongregantInput>, source = birthSource) {
    setInput((prev) => {
      const merged = { ...prev, ...next };
      if (
        "gregorianBirthDate" in next ||
        "hebrewBirthYear" in next ||
        "hebrewBirthMonth" in next ||
        "hebrewBirthDay" in next ||
        "bornAfterSunset" in next
      ) {
        return applyBirthConversion(merged, source).next;
      }
      return merged;
    });
    setError(null);
  }

  function changeBirthSource(source: BirthDateSource) {
    setBirthSource(source);
    setInput((prev) => applyBirthConversion(prev, source).next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = congregantId
        ? `/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants/${encodeURIComponent(congregantId)}`
        : `/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants`;
      const response = await fetch(url, {
        method: congregantId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, registrationStatus: congregantId ? input.registrationStatus : "approved" })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(mapCongregantApiError(payload.error));
        return;
      }
      router.push(listHref);
      router.refresh();
    } catch {
      setError("השמירה נכשלה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!congregantId) return;
    setApproving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants/${encodeURIComponent(congregantId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" })
        }
      );
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(mapCongregantApiError(payload.error));
        return;
      }
      setInput((prev) => ({ ...prev, registrationStatus: "approved" }));
    } catch {
      setError("האישור נכשל. נסו שוב.");
    } finally {
      setApproving(false);
    }
  }

  async function remove() {
    if (!congregantId) return;
    if (!window.confirm("למחוק את המתפלל? הפעולה אינה הפיכה.")) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants/${encodeURIComponent(congregantId)}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(mapCongregantApiError(payload.error));
        return;
      }
      router.push(listHref);
      router.refresh();
    } catch {
      setError("המחיקה נכשלה. נסו שוב.");
    } finally {
      setDeleting(false);
    }
  }

  const busy = saving || deleting || approving;

  return (
    <CongregantThemeFrame minyan={selectedMinyan}>
      <div className="congregant-card">
        <div className="congregant-card-head">
          <div>
            <h2>{congregantId ? "עריכת מתפלל" : "מתפלל חדש"}</h2>
            <p>
              {pending
                ? "נרשם לבד — ממתין לאישור"
                : selectedMinyan?.name
                  ? `העיצוב לפי מניין ${selectedMinyan.name}`
                  : "בחרו מניין כדי להתאים את העיצוב"}
            </p>
          </div>
        </div>
        <div className="congregant-card-body">
          <CongregantFields
            input={input}
            birthSource={birthSource}
            minyanim={minyanim}
            variant="gabbai"
            onPatch={patch}
            onBirthSource={changeBirthSource}
          />

          <div className="congregant-grid congregant-grid--2" style={{ marginTop: "0.75rem" }}>
            <label className="congregant-check">
              <input
                type="checkbox"
                checked={input.isActive}
                onChange={(e) => patch({ isActive: e.target.checked })}
              />
              פעיל
            </label>
            <label className="congregant-check">
              <input
                type="checkbox"
                checked={input.receivesAliyah}
                onChange={(e) => patch({ receivesAliyah: e.target.checked })}
              />
              עולה לתורה
            </label>
          </div>

          <label className="congregant-field" style={{ marginTop: "0.75rem" }}>
            <span>הערת גבאי</span>
            <textarea value={input.notes} onChange={(e) => patch({ notes: e.target.value })} />
          </label>

          <div className="gabbai-save" style={{ marginTop: "1.1rem" }}>
            <div className="gabbai-save-inner">
              <Button type="button" className="gabbai-save-btn" onClick={() => void save()} disabled={busy}>
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    שומר…
                  </span>
                ) : (
                  "שמירת המתפלל"
                )}
              </Button>
              {pending && congregantId ? (
                <Button type="button" variant="outline" onClick={() => void approve()} disabled={busy}>
                  {approving ? "מאשר…" : "אישור הרישום"}
                </Button>
              ) : null}
              {congregantId ? (
                <Button type="button" variant="outline" onClick={() => void remove()} disabled={busy}>
                  {deleting ? "מוחק…" : pending ? "דחייה ומחיקה" : "מחיקה"}
                </Button>
              ) : null}
              {error ? <span className="gabbai-err">{error}</span> : null}
            </div>
          </div>
        </div>
      </div>
    </CongregantThemeFrame>
  );
}
