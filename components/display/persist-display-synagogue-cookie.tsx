"use client";

import { useEffect } from "react";
import { isPhoneBrowser, isTvUserAgent, isWallSizedScreen } from "@/lib/handheld";

/** שומר את בית הכנסת מה-URL ב־cookie, ונועל תצוגת קיר כדי שריענון לא יברח ל־/m. */
export function PersistDisplaySynagogueCookie({ synagogueId }: { synagogueId: string | null }) {
  useEffect(() => {
    const maxAge = 60 * 60 * 24 * 180;
    const id = synagogueId?.trim();
    if (id) {
      document.cookie = `synagogue_id=${encodeURIComponent(id)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    }

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const lockWall = !isPhoneBrowser() || isWallSizedScreen() || isTvUserAgent(ua);
    if (lockWall) {
      document.cookie = `viewMode=full; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
  }, [synagogueId]);

  return null;
}
