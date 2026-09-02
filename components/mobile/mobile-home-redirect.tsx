"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildDisplayHref, getPreferredSynagogue } from "@/lib/mobile-synagogue-preference";

export function MobileHomeWaiting({ message = "טוען…" }: { message?: string }) {
  return (
    <div className="m-waiting" role="status" aria-live="polite" aria-busy="true">
      <div className="m-waiting-spin" aria-hidden />
      <p className="m-waiting-text">{message}</p>
    </div>
  );
}

/**
 * אם כבר נשמר בית כנסת (localStorage) — מסך המתנה והפניה, בלי בחירה.
 * `?pick=1` מציג את הבחירה במכוון.
 */
export function MobileHomeGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pick = searchParams.get("pick") === "1";
  const [showPicker, setShowPicker] = useState(pick);

  useEffect(() => {
    if (pick) {
      setShowPicker(true);
      return;
    }
    const pref = getPreferredSynagogue();
    if (pref) {
      router.replace(buildDisplayHref(pref));
      return;
    }
    setShowPicker(true);
  }, [pick, router]);

  if (!showPicker) {
    return <MobileHomeWaiting message="נכנסים לבית הכנסת…" />;
  }

  return <>{children}</>;
}
