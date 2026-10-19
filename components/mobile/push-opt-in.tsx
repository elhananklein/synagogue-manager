"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { isPushNotificationsEnabled } from "@/lib/push-feature";
import {
  currentPushSubscription,
  dismissPushBanner,
  pushBannerDismissed,
  pushEnableBlockReason,
  pushErrorMessage,
  subscribeToPush,
  unsubscribeFromPush
} from "@/lib/push-client";

type Status = "loading" | "unsupported" | "insecure" | "ios_browser" | "denied" | "off" | "on";

export function MobilePushOptIn({
  synagogueId,
  minyanId = null
}: {
  synagogueId: string | null | undefined;
  minyanId?: string | null;
}) {
  const enabled = isPushNotificationsEnabled(synagogueId);
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!enabled || !synagogueId) return;
    let cancelled = false;
    void (async () => {
      const block = pushEnableBlockReason();
      if (block === "insecure") {
        if (!cancelled) {
          setStatus("insecure");
          setShowBanner(false);
        }
        return;
      }
      if (block === "ios_browser") {
        if (!cancelled) {
          setStatus("ios_browser");
          setShowBanner(false);
        }
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
      if (sub) {
        setStatus("on");
        setShowBanner(false);
        return;
      }
      setStatus("off");
      setShowBanner(!pushBannerDismissed(synagogueId));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, synagogueId]);

  if (!enabled || !synagogueId) return null;

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await subscribeToPush(synagogueId!, minyanId);
      setStatus("on");
      setShowBanner(false);
      dismissPushBanner(synagogueId!);
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

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      setStatus("off");
    } catch {
      setError("הביטול נכשל. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  function hideBanner() {
    if (!synagogueId) return;
    dismissPushBanner(synagogueId);
    setShowBanner(false);
  }

  const blocked = status === "unsupported" || status === "insecure" || status === "ios_browser";

  return (
    <div className="m-push">
      {showBanner && status === "off" ? (
        <div className="m-push-banner" role="region" aria-label="התראות">
          <div className="m-push-banner-text">
            <strong>לקבל עדכונים מבית הכנסת?</strong>
            <span>התראה כשיש הודעה חשובה מהגבאי.</span>
          </div>
          <div className="m-push-banner-actions">
            <button type="button" className="m-push-btn m-push-btn--primary" disabled={busy} onClick={() => void enable()}>
              {busy ? "…" : "כן, לעדכן אותי"}
            </button>
            <button type="button" className="m-push-btn" disabled={busy} onClick={hideBanner} aria-label="סגירה">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`m-push-toggle${status === "on" ? " m-push-toggle--on" : ""}`}
        disabled={busy || status === "loading" || blocked}
        onClick={() => void (status === "on" ? disable() : enable())}
        title={
          status === "on"
            ? "התראות פעילות — לחיצה לביטול"
            : status === "denied"
              ? "ההרשאה חסומה בהגדרות הדפדפן"
              : blocked
                ? pushErrorMessage(status)
                : "הפעלת התראות מבית הכנסת"
        }
      >
        {status === "on" ? <Bell className="h-4 w-4" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}
        <span>{status === "on" ? "התראות פעילות" : "התראות"}</span>
      </button>

      {status === "denied" ? <p className="m-push-hint">{pushErrorMessage("denied")}</p> : null}
      {status === "unsupported" ? <p className="m-push-hint">{pushErrorMessage("unsupported")}</p> : null}
      {status === "insecure" ? <p className="m-push-hint m-push-hint--err">{pushErrorMessage("insecure")}</p> : null}
      {status === "ios_browser" ? <p className="m-push-hint">{pushErrorMessage("ios_browser")}</p> : null}
      {error ? <p className="m-push-hint m-push-hint--err">{error}</p> : null}
    </div>
  );
}
