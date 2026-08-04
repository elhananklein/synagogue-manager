"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed";
const PROMPT_CAPTURED_EVENT = "pwa-prompt-captured";

// תפיסה מוקדמת: האירוע עלול להיות מופעל לפני שהרכיב נטען. שומרים אותו גלובלית
// כדי שהכפתור יופיע גם אם ה-effect רץ מאוחר יותר.
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
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
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
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

export function PwaInstallBanner({
  className,
  title,
  description,
  installLabel
}: {
  className?: string;
  /** כותרת מותאמת (למשל עבור אפליקציית הניהול) */
  title?: string;
  /** תיאור מותאם */
  description?: string;
  /** תווית כפתור ההתקנה (אנדרואיד) */
  installLabel?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    if (isIos()) {
      setShowIosHint(true);
      setHidden(false);
      return;
    }

    // אנדרואיד: מציגים את הבאנר תמיד; אם אירוע ההתקנה נורה — נוסיף כפתור התקנה.
    setHidden(false);

    // אם האירוע כבר נתפס לפני הטעינה — משתמשים בו מיד.
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
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener(PROMPT_CAPTURED_EVENT, onCaptured);
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    capturedPrompt = null;
    setDeferredPrompt(null);
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showIosHint ? (
            <>
              <p className="font-semibold">{title ?? "התקנת האפליקציה"}</p>
              <p className="mt-1 text-emerald-800/90">
                ב-Safari: לחצו על <Share className="mx-0.5 inline h-4 w-4 align-text-bottom" /> שיתוף, ואז «הוסף למסך
                הבית».
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">{title ?? "התקינו את האפליקציה"}</p>
              <p className="mt-1 text-emerald-800/90">
                {description ?? "גישה מהירה לזמני תפילה והלכה ישירות ממסך הבית."}
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          aria-label="סגור"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-emerald-700 hover:bg-emerald-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!showIosHint && deferredPrompt ? (
        <button
          type="button"
          onClick={() => void install()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white active:scale-[0.99]"
        >
          <Download className="h-4 w-4" />
          {installLabel ?? "התקן אפליקציה"}
        </button>
      ) : null}

      {!showIosHint && !deferredPrompt ? (
        <p className="mt-2 text-xs text-emerald-800/90">
          אם כפתור ההתקנה אינו מופיע — פתחו את תפריט הדפדפן ובחרו «התקנת אפליקציה» / «הוסף למסך הבית».
        </p>
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
