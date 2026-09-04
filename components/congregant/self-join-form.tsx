"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CongregantThemeFrame } from "@/components/admin/congregant-theme-frame";
import { CongregantFields } from "@/components/congregant/congregant-fields";
import { mapCongregantApiError } from "@/lib/congregant-errors";
import {
  applyBirthConversion,
  emptyCongregantInput,
  type BirthDateSource,
  type CongregantInput,
  type CongregantMinyanOption
} from "@/lib/congregant-types";

export function CongregantSelfJoinForm({
  synagogueId,
  synagogueName,
  minyanim,
  initialMinyanId,
  embedded = false
}: {
  synagogueId: string;
  synagogueName: string;
  minyanim: CongregantMinyanOption[];
  initialMinyanId?: string | null;
  embedded?: boolean;
}) {
  const startMinyan =
    initialMinyanId && minyanim.some((item) => item.id === initialMinyanId)
      ? initialMinyanId
      : minyanim.length === 1
        ? minyanim[0].id
        : null;
  const [input, setInput] = useState<CongregantInput>(emptyCongregantInput(startMinyan));
  const [birthSource, setBirthSource] = useState<BirthDateSource>("gregorian");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const selectedMinyan = useMemo(
    () => minyanim.find((item) => item.id === input.minyanId) ?? minyanim[0] ?? null,
    [input.minyanId, minyanim]
  );

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/join/${encodeURIComponent(synagogueId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          website,
          registrationStatus: "pending"
        })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(mapCongregantApiError(payload.error));
        return;
      }
      setSent(true);
    } catch {
      setError("השליחה נכשלה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CongregantThemeFrame minyan={selectedMinyan}>
      <div className={embedded ? "congregant-join-page congregant-join-page--embedded" : "congregant-join-page"}>
        <div className="congregant-card">
          {!embedded ? (
            <div className="congregant-card-head">
              <div>
                <h2>הרשמה — {synagogueName}</h2>
                <p>מלאו את הפרטים. הגבאי יאשר את הרישום.</p>
              </div>
            </div>
          ) : null}
          <div className="congregant-card-body">
            {embedded ? <p className="gabbai-page-desc">מלאו את הפרטים. הגבאי יאשר את הרישום.</p> : null}
            {sent ? (
              <p className="congregant-join-success">
                הבקשה נשלחה. כשהגבאי יאשר — תופיעו ברשימת המתפללים של בית הכנסת.
              </p>
            ) : (
              <form onSubmit={(event) => void submit(event)}>
                <CongregantFields
                  input={input}
                  birthSource={birthSource}
                  minyanim={minyanim}
                  variant="self"
                  onPatch={patch}
                  onBirthSource={changeBirthSource}
                />
                <label className="congregant-honeypot" aria-hidden>
                  אתר
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
                {error ? <p className="gabbai-err" style={{ marginTop: "0.85rem" }}>{error}</p> : null}
                <div className="congregant-public-submit">
                  <Button type="submit" className="congregant-public-submit-btn" disabled={saving}>
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        שולח…
                      </span>
                    ) : (
                      "שליחה לאישור הגבאי"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </CongregantThemeFrame>
  );
}
