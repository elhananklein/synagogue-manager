"use client";

import { useEffect } from "react";
import { setPreferredSynagogue } from "@/lib/mobile-synagogue-preference";

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
    setPreferredSynagogue({
      synagogueId: synagogueId.trim(),
      minyan: minyan?.trim() || null
    });
  }, [synagogueId, minyan]);

  return null;
}
