"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CongregantGender } from "@/lib/congregant-types";

function stateText(consent: boolean, gender: CongregantGender) {
  const female = gender === "female";
  if (consent) {
    return female
      ? "את רשומה לקבלת הודעות מבית הכנסת, למשל אחרי עלייה לתורה, כולל בקשות לתרומה."
      : "אתה רשום לקבלת הודעות מבית הכנסת, למשל אחרי עלייה לתורה, כולל בקשות לתרומה.";
  }
  return female ? "את לא רשומה לקבלת הודעות מבית הכנסת." : "אתה לא רשום לקבלת הודעות מבית הכנסת.";
}

export function MessagesConsentPanel({
  token,
  firstName,
  gender,
  initialConsent
}: {
  token: string;
  firstName: string;
  gender: CongregantGender;
  initialConsent: boolean;
}) {
  const [consent, setConsent] = useState(initialConsent);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(next: boolean) {
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: next })
      });
      const payload = (await response.json()) as { ok: boolean; data?: { consent: boolean } };
      if (!payload.ok || !payload.data) {
        setError("השמירה נכשלה. נסו שוב.");
        return;
      }
      setConsent(payload.data.consent);
      setDone(payload.data.consent ? "תודה! האישור נשמר." : "בוטל. לא יישלחו אליך יותר הודעות מבית הכנסת.");
    } catch {
      setError("השמירה נכשלה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {firstName ? <p className="messages-consent-state">שלום {firstName},</p> : null}
      <p className="messages-consent-state">{stateText(consent, gender)}</p>
      {done ? <p className="congregant-join-success">{done}</p> : null}
      {error ? <p className="gabbai-err">{error}</p> : null}
      <div className="congregant-public-submit">
        <Button
          type="button"
          className="congregant-public-submit-btn"
          variant={consent ? "outline" : "default"}
          disabled={saving}
          onClick={() => void update(!consent)}
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              שומר…
            </span>
          ) : consent ? (
            "ביטול קבלת ההודעות"
          ) : (
            "אני מאשר/ת לקבל הודעות"
          )}
        </Button>
      </div>
    </>
  );
}
