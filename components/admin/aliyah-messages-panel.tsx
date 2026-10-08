"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import {
  messagesConsentPath,
  renderAliyahMessage,
  resolveAliyahMessageTemplate,
  whatsappLink,
  whatsappPhone
} from "@/lib/aliyah-message";
import type { AliyahCongregantOption, AliyahMessaging, AliyahSheet, AliyahSlotState } from "@/lib/aliyah-types";
import { getPublicSiteUrl } from "@/lib/site-url";

function formatSentTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "numeric",
    timeZone: "Asia/Jerusalem"
  }).format(date);
}

export function AliyahMessagesPanel({
  synagogueId,
  minyanId,
  sheet,
  slots,
  byId,
  messaging,
  dirty,
  onSent
}: {
  synagogueId: string;
  minyanId: string;
  sheet: AliyahSheet;
  slots: AliyahSlotState[];
  byId: Map<string, AliyahCongregantOption>;
  messaging: AliyahMessaging | null;
  dirty: boolean;
  onSent: (congregantId: string, openedAt: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const seen = new Set<string>();
  const rows: Array<{ person: AliyahCongregantOption; slotLabel: string }> = [];
  for (const slot of slots) {
    const person = slot.congregantId ? byId.get(slot.congregantId) : null;
    if (!person || seen.has(person.id)) continue;
    seen.add(person.id);
    rows.push({ person, slotLabel: slot.label });
  }
  if (!rows.length) return null;

  const template = resolveAliyahMessageTemplate(messaging?.template);
  const needsDonationUrl = template.includes("{קישור_תרומה}") && !messaging?.donationUrl.trim();
  const settingsHref = `/admin/gabbai/${encodeURIComponent(synagogueId)}/settings`;
  const blocker = !messaging?.ready
    ? "כדי לשלוח הודעות צריך להריץ ב-Supabase את הקובץ supabase/aliyah-messages-migration.sql."
    : dirty || !sheet.isSaved
      ? "שמרו את העליות, ואז אפשר לשלוח הודעות."
      : null;

  function send(person: AliyahCongregantOption) {
    const phone = whatsappPhone(person.phone);
    if (!phone || !messaging || !person.messagesToken) return;
    const text = renderAliyahMessage(messaging.template, {
      firstName: person.nickname.trim() || person.firstName,
      kind: sheet.kind,
      parashaLabel: sheet.parashaLabel,
      weekday: sheet.weekday,
      hebrewDate: sheet.hebrewDate,
      synagogueName: messaging.synagogueName,
      donationUrl: messaging.donationUrl,
      optOutUrl: `${getPublicSiteUrl()}${messagesConsentPath(person.messagesToken)}`
    });
    window.open(whatsappLink(phone, text), "_blank", "noopener,noreferrer");
    setError(null);
    void fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}/aliyot/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minyanId, serviceDate: sheet.serviceDate, congregantId: person.id })
    })
      .then(async (response) => {
        const payload = (await response.json()) as { ok: boolean; error?: string; data?: { openedAt?: string } };
        if (payload.ok && payload.data?.openedAt) onSent(person.id, payload.data.openedAt);
        else setError("ההודעה נפתחה, אבל הרישום ביומן נכשל.");
      })
      .catch(() => setError("ההודעה נפתחה, אבל הרישום ביומן נכשל."));
  }

  return (
    <section className="aliyah-messages">
      <div className="aliyah-slot-head">
        <h2>הודעות לעולים</h2>
      </div>
      <p className="aliyah-slot-hint">
        «שליחה בוואטסאפ» פותח את הוואטסאפ שלכם עם ההודעה מוכנה. נשאר רק ללחוץ «שלח».
      </p>
      {blocker ? <p className="aliyah-slot-hint aliyah-slot-warn">{blocker}</p> : null}
      {!blocker && needsDonationUrl ? (
        <p className="aliyah-slot-hint aliyah-slot-warn">
          חסר קישור לתרומה. <Link href={settingsHref}>הוסיפו אותו בהגדרות בית הכנסת</Link>.
        </p>
      ) : null}
      {error ? <p className="aliyah-slot-hint aliyah-slot-warn">{error}</p> : null}
      <ul className="aliyah-message-list">
        {rows.map(({ person, slotLabel }) => {
          const phone = whatsappPhone(person.phone);
          const sentAt = messaging?.sentAt[person.id];
          const reason = !person.messagesConsent
            ? "לא אישר קבלת הודעות"
            : !phone
              ? "אין מספר טלפון תקין"
              : !person.messagesToken
                ? "חסר קישור הסרה"
                : null;
          const disabled = Boolean(blocker || needsDonationUrl || reason);
          return (
            <li key={person.id} className="aliyah-message-row">
              <div className="aliyah-message-who">
                <strong>{person.displayName}</strong>
                <span>
                  {slotLabel}
                  {sentAt ? ` · נשלח ${formatSentTime(sentAt)}` : ""}
                </span>
              </div>
              {reason ? (
                <span className="aliyah-message-reason">{reason}</span>
              ) : (
                <button type="button" className="aliyah-wa-btn" disabled={disabled} onClick={() => send(person)}>
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {sentAt ? "שליחה שוב" : "שליחה בוואטסאפ"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
