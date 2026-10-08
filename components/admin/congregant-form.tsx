"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CongregantThemeFrame } from "@/components/admin/congregant-theme-frame";
import { CongregantFamilyFields, toFamilyOptions } from "@/components/admin/congregant-family-fields";
import { CongregantFields } from "@/components/congregant/congregant-fields";
import { messagesConsentPath, whatsappLink, whatsappPhone } from "@/lib/aliyah-message";
import { mapCongregantApiError } from "@/lib/congregant-errors";
import {
  applyBirthConversion,
  MESSAGES_CONSENT_SOURCE_LABELS,
  type BirthDateSource,
  type CongregantInput,
  type CongregantMinyanOption,
  type CongregantRecord,
  type MessagesConsentSource
} from "@/lib/congregant-types";
import { getPublicSiteUrl } from "@/lib/site-url";

type ConsentMeta = {
  at: string | null;
  source: MessagesConsentSource | null;
  token: string;
};

function formatConsentDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jerusalem"
  }).format(date);
}

function consentMetaText(consent: boolean, meta: ConsentMeta | undefined) {
  if (!meta?.at) return consent ? "" : "עדיין לא אישר קבלת הודעות.";
  const date = formatConsentDate(meta.at);
  const via = meta.source ? ` דרך ${MESSAGES_CONSENT_SOURCE_LABELS[meta.source]}` : "";
  return `${consent ? "אישר" : "ביטל"} ב-${date}${via}.`;
}

export function CongregantForm({
  synagogueId,
  minyanim,
  initial,
  congregantId,
  familyPeople = [],
  consentMeta
}: {
  synagogueId: string;
  minyanim: CongregantMinyanOption[];
  initial: CongregantInput;
  congregantId?: string;
  familyPeople?: CongregantRecord[];
  consentMeta?: ConsentMeta;
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
  const [people, setPeople] = useState(familyPeople);

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

  function sendConsentLink() {
    const phone = whatsappPhone(input.phone);
    if (!phone || !consentMeta?.token) return;
    const url = `${getPublicSiteUrl()}${messagesConsentPath(consentMeta.token)}`;
    const name = input.nickname.trim() || input.firstName.trim();
    const text = `שלום${name ? ` ${name}` : ""}, כאן אפשר לאשר או לבטל קבלת הודעות מבית הכנסת: ${url}`;
    window.open(whatsappLink(phone, text), "_blank", "noopener,noreferrer");
  }

  const busy = saving || deleting || approving;
  const consentChanged = input.messagesConsent !== initial.messagesConsent;
  const canSendConsentLink = Boolean(congregantId && consentMeta?.token && whatsappPhone(input.phone));

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

          <CongregantFamilyFields
            synagogueId={synagogueId}
            minyanim={minyanim}
            minyanId={input.minyanId}
            excludeId={congregantId}
            people={toFamilyOptions(people)}
            value={input.familyMembers}
            onChange={(familyMembers) => patch({ familyMembers })}
            onPersonAdded={(row) => setPeople((prev) => (prev.some((item) => item.id === row.id) ? prev : [...prev, row]))}
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

          <div className="congregant-consent-box">
            <label className="congregant-check">
              <input
                type="checkbox"
                checked={input.messagesConsent}
                onChange={(e) => patch({ messagesConsent: e.target.checked })}
              />
              מאשר לקבל הודעות (וואטסאפ / SMS)
            </label>
            <p className="congregant-consent-meta" suppressHydrationWarning>
              {consentChanged
                ? "השינוי יירשם בשמירת המתפלל, כאישור או ביטול דרך הגבאי."
                : consentMetaText(input.messagesConsent, consentMeta)}
            </p>
            {congregantId ? (
              <div className="congregant-consent-actions">
                <Button type="button" variant="outline" size="sm" onClick={sendConsentLink} disabled={!canSendConsentLink}>
                  שליחת קישור אישור בוואטסאפ
                </Button>
                {!canSendConsentLink ? (
                  <span className="congregant-consent-meta">צריך מספר טלפון תקין כדי לשלוח.</span>
                ) : null}
              </div>
            ) : null}
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
