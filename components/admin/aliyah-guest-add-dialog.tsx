"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mapCongregantApiError } from "@/lib/congregant-errors";
import {
  CONGREGANT_TRIBE_LABELS,
  CONGREGANT_TRIBES,
  emptyCongregantInput,
  type CongregantRecord,
  type CongregantTribe
} from "@/lib/congregant-types";

function guessNames(query: string) {
  const parts = query.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  return { firstName: parts[0] ?? "", lastName: "" };
}

export function AliyahGuestAddDialog({
  synagogueId,
  minyanId,
  nameQuery,
  preferredTribe = null,
  onClose,
  onCreated
}: {
  synagogueId: string;
  minyanId: string | null;
  nameQuery: string;
  preferredTribe?: CongregantTribe | null;
  onClose: () => void;
  onCreated: (row: CongregantRecord) => void;
}) {
  const guessed = guessNames(nameQuery);
  const [firstName, setFirstName] = useState(guessed.firstName);
  const [lastName, setLastName] = useState(guessed.lastName);
  const [phone, setPhone] = useState("");
  const [tribe, setTribe] = useState<CongregantTribe>(preferredTribe ?? "yisrael");
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

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/congregants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...emptyCongregantInput(minyanId),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          tribe,
          gender: "male",
          guest: true,
          isGuest: true,
          messagesConsent: true,
          receivesAliyah: true,
          isActive: true,
          registrationStatus: "approved"
        })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; data?: CongregantRecord };
      if (!payload.ok || !payload.data) {
        setError(mapCongregantApiError(payload.error) || payload.error || "השמירה נכשלה");
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
        aria-labelledby="aliyah-guest-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="aliyah-modal-head">
          <div>
            <h2 id="aliyah-guest-title">עליית אורח</h2>
            <p>שם פרטי ומשפחה מספיקים. הטלפון לא חובה — בלי טלפון לא תישלח הודעת וואטסאפ.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose} aria-label="סגירה">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <div className="congregant-grid congregant-grid--2" style={{ marginTop: "0.5rem" }}>
          <label className="congregant-field">
            <span>שם פרטי</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
          </label>
          <label className="congregant-field">
            <span>שם משפחה</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label className="congregant-field">
            <span>טלפון (לא חובה)</span>
            <input
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05…"
            />
          </label>
          <label className="congregant-field">
            <span>כהן / לוי / ישראל</span>
            <select value={tribe} onChange={(e) => setTribe(e.target.value as CongregantTribe)}>
              {CONGREGANT_TRIBES.map((value) => (
                <option key={value} value={value}>
                  {CONGREGANT_TRIBE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.65rem", marginTop: "1rem" }}>
          <Button
            type="button"
            className="gabbai-save-btn"
            onClick={() => void save()}
            disabled={saving || !firstName.trim() || !lastName.trim()}
          >
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
