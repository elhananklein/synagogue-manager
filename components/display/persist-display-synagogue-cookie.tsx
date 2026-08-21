"use client";

import { useEffect } from "react";

/** שומר את בית הכנסת מה-URL ב־cookie לתצוגת קיר (/display בלי פרמטרים). */
export function PersistDisplaySynagogueCookie({ synagogueId }: { synagogueId: string | null }) {
  useEffect(() => {
    const id = synagogueId?.trim();
    if (!id) return;
    const maxAge = 60 * 60 * 24 * 180;
    document.cookie = `synagogue_id=${encodeURIComponent(id)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  }, [synagogueId]);

  return null;
}
