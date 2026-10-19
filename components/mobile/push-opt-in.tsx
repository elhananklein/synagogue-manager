"use client";

import { useEffect, useState } from "react";
import { BellOff, X } from "lucide-react";
import { isPushNotificationsEnabled } from "@/lib/push-feature";
import {
  currentPushSubscription,
  dismissPushBanner,
  PUSH_BANNER_DISMISSED_EVENT,
  pushBannerDismissed,
  pushEnableBlockReason,
  pushErrorMessage,
  subscribeToPush
} from "@/lib/push-client";

type Status = "loading" | "unsupported" | "insecure" | "ios_browser" | "denied" | "off" | "on";

export function MobilePushOptIn({
  synagogueId,
  minyanId = null,
  slot = "top"
}: {
  synagogueId: string | null | undefined;
  minyanId?: string | null;
  /** למעלה בפעם הראשונה; למטה אחרי סגירת ה־X */
  slot?: "top" | "bottom";
}) {
  const enabled = isPushNotificationsEnabled(synagogueId);
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled || !synagogueId) return;
    setDismissed(pushBannerDismissed(synagogueId));
    const onDismiss = (event: Event) => {
      const detail = (event as CustomEvent<{ synagogueId?: string }>).detail;
      if (detail?.synagogueId === synagogueId) setDismissed(true);
    };
    window.addEventListener(PUSH_BANNER_DISMISSED_EVENT, onDismiss);
    return () => window.removeEventListener(PUSH_BANNER_DISMISSED_EVENT, onDismiss);
  }, [enabled, synagogueId]);

  useEffect(() => {
    if (!enabled || !synagogueId) return;
    let cancelled = false;
    void (async () => {
      const block = pushEnableBlockReason();
      if (block === "insecure") {
        if (!cancelled) setStatus("insecure");
        return;
      }
      if (block === "ios_browser") {
        if (!cancelled) setStatus("ios_browser");
        return;
      }
      if (block === "unsupported") {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      const sub = await currentPushSubscription();
      if (cancelled) return;
      setStatus(sub ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, synagogueId]);

  if (!enabled || !synagogueId) return null;
  if (status === "loading" || status === "on") return null;

  // למעלה רק לפני סגירה; למטה רק אחרי X
  if (slot === "top" && dismissed) return null;
  if (slot === "bottom" && !dismissed) return null;

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await subscribeToPush(synagogueId!, minyanId);
      setStatus("on");
    } catch (err) {
      const code = err instanceof Error ? err.message : "failed";
      if (code === "denied") setStatus("denied");
      else if (code === "unsupported") setStatus("unsupported");
      else if (code === "insecure") setStatus("insecure");
      else if (code === "ios_browser") setStatus("ios_browser");
      else setError(pushErrorMessage(code));
    } finally {
      setBusy(false);
    }
  }

  function hideBanner() {
    if (!synagogueId) return;
    dismissPushBanner(synagogueId);
    setDismissed(true);
  }

  const blocked = status === "unsupported" || status === "insecure" || status === "ios_browser";
  const hints = (
    <>
      {status === "denied" ? <p className="m-push-hint">{pushErrorMessage("denied")}</p> : null}
      {status === "unsupported" ? <p className="m-push-hint">{pushErrorMessage("unsupported")}</p> : null}
      {status === "insecure" ? <p className="m-push-hint m-push-hint--err">{pushErrorMessage("insecure")}</p> : null}
      {status === "ios_browser" ? <p className="m-push-hint">{pushErrorMessage("ios_browser")}</p> : null}
      {error ? <p className="m-push-hint m-push-hint--err">{error}</p> : null}
    </>
  );

  if (slot === "top") {
    return (
      <div className="m-push m-push--top">
        <div className="m-push-banner" role="region" aria-label="התראות">
          <div className="m-push-banner-text">
            <strong>לקבל עדכונים מבית הכנסת?</strong>
            <span>התראה כשיש הודעה חשובה מהגבאי.</span>
          </div>
          <div className="m-push-banner-actions">
            <button
              type="button"
              className="m-push-btn m-push-btn--primary"
              disabled={busy || blocked || status === "denied"}
              onClick={() => void enable()}
              title={blocked ? pushErrorMessage(status) : undefined}
            >
              {busy ? "…" : "אישור התראות"}
            </button>
            <button type="button" className="m-push-btn" disabled={busy} onClick={hideBanner} aria-label="סגירה">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        {hints}
      </div>
    );
  }

  return (
    <div className="m-push m-push--bottom">
      <button
        type="button"
        className="m-push-toggle"
        disabled={busy || blocked || status === "denied"}
        onClick={() => void enable()}
        title={
          status === "denied"
            ? "ההרשאה חסומה בהגדרות הדפדפן"
            : blocked
              ? pushErrorMessage(status)
              : "הפעלת התראות מבית הכנסת"
        }
      >
        <BellOff className="h-4 w-4" aria-hidden />
        <span>אישור התראות</span>
      </button>
      {hints}
    </div>
  );
}
