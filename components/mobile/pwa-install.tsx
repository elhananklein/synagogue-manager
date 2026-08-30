"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DEFAULT_DISMISS_KEY = "pwa-install-dismissed";
const PROMPT_CAPTURED_EVENT = "pwa-prompt-captured";

// תפיסה מוקדמת: האירוע עלול להיות מופעל לפני שהרכיב נטען.
let capturedPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    capturedPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(PROMPT_CAPTURED_EVENT));
  });
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(async (reg) => {
        await reg.update();
        // מבטיח שה-SW שולט בדף — קריטי ל-WebAPK באנדרואיד.
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        await navigator.serviceWorker.ready;
      })
      .catch(() => {});
  }, []);
  return null;
}

export function PwaInstallBanner({
  className,
  title,
  description,
  installLabel,
  dismissKey = DEFAULT_DISMISS_KEY
}: {
  className?: string;
  title?: string;
  description?: string;
  installLabel?: string;
  /** מפתח נפרד לסגירה (למשל לאפליקציית ניהול) */
  dismissKey?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem(dismissKey) === "1") return;

    if (isIos()) {
      setShowIosHint(true);
      setHidden(false);
      return;
    }

    setHidden(false);
    if (capturedPrompt) setDeferredPrompt(capturedPrompt);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onCaptured = () => {
      if (capturedPrompt) setDeferredPrompt(capturedPrompt);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener(PROMPT_CAPTURED_EVENT, onCaptured);

    // לפעמים האירוע מגיע רק אחרי שה-SW פעיל.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener(PROMPT_CAPTURED_EVENT, onCaptured);
    };
  }, [dismissKey]);

  const dismiss = () => {
    sessionStorage.setItem(dismissKey, "1");
    setHidden(true);
  };

  const onInstallClick = async () => {
    if (showIosHint) {
      setShowManual(true);
      return;
    }

    if (deferredPrompt) {
      setBusy(true);
      try {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        capturedPrompt = null;
        setDeferredPrompt(null);
        setHidden(true);
      } finally {
        setBusy(false);
      }
      return;
    }

    // אין beforeinstallprompt — מציגים הוראות התקנה ידניות (כפתור עדיין נראה ופעיל).
    setShowManual((v) => !v);
  };

  if (hidden) return null;

  return (
    <div className={cn("m-pwa text-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-pwa-title">{title ?? (showIosHint ? "התקנת האפליקציה" : "התקינו את האפליקציה")}</p>
          <p className="m-pwa-desc">
            {showIosHint
              ? "ב-Safari: לחצו על כפתור ההתקנה למטה להוראות קצרות."
              : description ?? "גישה מהירה ישירות ממסך הבית."}
          </p>
        </div>
        <button type="button" aria-label="סגור" onClick={dismiss} className="m-pwa-close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => void onInstallClick()}
        disabled={busy}
        className="m-pwa-cta"
      >
        {showIosHint ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        {busy ? "פותח…" : installLabel ?? (showIosHint ? "איך להתקין ב-iPhone" : "התקן אפליקציה")}
      </button>

      {showManual ? (
        <div className="m-pwa-manual">
          {showIosHint ? (
            <ol className="list-decimal space-y-1 pr-4">
              <li>
                לחצו על <Share className="inline h-3.5 w-3.5 align-text-bottom" /> שיתוף בתחתית Safari
              </li>
              <li>גללו ובחרו «הוסף למסך הבית»</li>
              <li>אשרו — האייקון ייפתח ישירות לניהול</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1 pr-4">
              <li>פתחו את תפריט Chrome (⋮)</li>
              <li>בחרו «הוסף למסך הבית»</li>
              <li>
                חשוב: בחרו <strong>«התקן אפליקציה»</strong> / Install app — לא «צור קיצור דרך»
              </li>
            </ol>
          )}
          {!showIosHint && !deferredPrompt ? (
            <p className="m-pwa-desc mt-2">
              אם מופיע רק «צור קיצור דרך» — הסירו קיצורים/אפליקציות ישנות של האתר ממסך הבית, רעננו את הדף
              (לאחר העדכון), ונסו שוב כשאתם מחוברים לניהול.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** רישום SW + באנר התקנה — לשימוש ב-layout או בדפי מובייל. */
export function PwaMobileShell({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <PwaServiceWorkerRegister />
      {children}
    </>
  );
}
