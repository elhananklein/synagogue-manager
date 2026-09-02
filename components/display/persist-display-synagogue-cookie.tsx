"use client";

import { useEffect } from "react";
import { isPhoneBrowser, isTvUserAgent, isWallSizedScreen } from "@/lib/handheld";
import { setSynagogueIdCookie } from "@/lib/synagogue-id";

/** שומר את בית הכנסת מה-URL ב־cookie, ונועל תצוגת קיר כדי שריענון לא יברח ל־/m. */
export function PersistDisplaySynagogueCookie({ synagogueId }: { synagogueId: string | null }) {
  useEffect(() => {
    const id = synagogueId?.trim();
    if (id) {
      setSynagogueIdCookie(id);
    }

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const lockWall = !isPhoneBrowser() || isWallSizedScreen() || isTvUserAgent(ua);
    if (lockWall) {
      document.cookie = `viewMode=full; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
  }, [synagogueId]);

  return null;
}
