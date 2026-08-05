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
      .register("/sw.js")
      .then((reg) => reg.update())
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
    <div
      className={cn(
        "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title ?? (showIosHint ? "התקנת האפליקציה" : "התקינו את האפליקציה")}</p>
          <p className="mt-1 text-emerald-800/90">
            {showIosHint
              ? "ב-Safari: לחצו על כפתור ההתקנה למטה להוראות קצרות."
              : description ?? "גישה מהירה ישירות ממסך הבית."}
          </p>
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

      <button
        type="button"
        onClick={() => void onInstallClick()}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {showIosHint ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        {busy ? "פותח…" : installLabel ?? (showIosHint ? "איך להתקין ב-iPhone" : "התקן אפליקציה")}
      </button>

      {showManual ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 text-xs leading-relaxed text-emerald-900">
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
              <li>פתחו את תפריט Chrome (⋮) בפינה העליונה</li>
              <li>בחרו «התקנת אפליקציה» או «הוסף למסך הבית»</li>
              <li>אשרו את ההתקנה</li>
            </ol>
          )}
          {!showIosHint && !deferredPrompt ? (
            <p className="mt-2 text-emerald-800/80">
              אם האפשרות לא מופיעה — ייתכן שכבר מותקנת אפליקציה אחרת מהאתר. הסירו אותה ממסך הבית ונסו שוב, או
              התקינו דרך התפריט מהדף הזה.
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
