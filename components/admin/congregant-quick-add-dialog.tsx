"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CongregantFields } from "@/components/congregant/congregant-fields";
import { mapCongregantApiError } from "@/lib/congregant-errors";
import {
  applyBirthConversion,
  emptyCongregantInput,
  type BirthDateSource,
  type CongregantInput,
  type CongregantMinyanOption,
  type CongregantRecord
} from "@/lib/congregant-types";

function guessNames(query: string) {
  const parts = query.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  return { firstName: parts[0] ?? "", lastName: "" };
}

export function CongregantQuickAddDialog({
  synagogueId,
  minyanim,
  minyanId,
  nameQuery,
  onClose,
  onCreated
}: {
  synagogueId: string;
  minyanim: CongregantMinyanOption[];
  minyanId: string | null;
  nameQuery: string;
  onClose: () => void;
  onCreated: (row: CongregantRecord) => void;
}) {
  const guessed = guessNames(nameQuery);
  const [input, setInput] = useState<CongregantInput>({
    ...emptyCongregantInput(minyanId),
    firstName: guessed.firstName,
    lastName: guessed.lastName,
    receivesAliyah: true,
    isActive: true,
    registrationStatus: "approved"
  });
  const [birthSource, setBirthSource] = useState<BirthDateSource>("gregorian");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

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

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, registrationStatus: "approved" })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; data?: CongregantRecord };
      if (!payload.ok || !payload.data) {
        setError(mapCongregantApiError(payload.error));
        return;
      }
      onCreated(payload.data);
    } catch {
      setError("השמירה נכשלה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="aliyah-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="aliyah-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aliyah-add-congregant-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="aliyah-modal-head">
          <div>
            <h2 id="aliyah-add-congregant-title">מתפלל חדש</h2>
            <p>אחרי השמירה נחזור ישר לעלייה, בלי לעבור מסך.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose} aria-label="סגירה">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <CongregantFields
          input={input}
          birthSource={birthSource}
          minyanim={minyanim}
          variant="gabbai"
          onPatch={patch}
          onBirthSource={(source) => {
            setBirthSource(source);
            setInput((prev) => applyBirthConversion(prev, source).next);
          }}
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
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.65rem", marginTop: "1rem" }}>
          <Button type="button" className="gabbai-save-btn" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                שומר…
              </span>
            ) : (
              "שמירה והמשך לעלייה"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          {error ? <span className="gabbai-err">{error}</span> : null}
        </div>
      </div>
    </div>
  );
}
