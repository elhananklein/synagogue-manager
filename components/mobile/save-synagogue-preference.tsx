"use client";

import { useEffect } from "react";
import { setPreferredSynagogue } from "@/lib/mobile-synagogue-preference";
import { setSynagogueIdCookie } from "@/lib/synagogue-id";

/** שומר ב-localStorage את בית הכנסת מה-URL (לפתיחה ישירה בכניסה הבאה). */
export function SaveSynagoguePreference({
  synagogueId,
  minyan
}: {
  synagogueId: string | null;
  minyan?: string | null;
}) {
  useEffect(() => {
    if (!synagogueId?.trim()) return;
    const id = synagogueId.trim();
    setPreferredSynagogue({
      synagogueId: id,
      minyan: minyan?.trim() || null
    });
    setSynagogueIdCookie(id);
  }, [synagogueId, minyan]);

  return null;
}
