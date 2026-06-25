const STORAGE_KEY = "synagogue-preferred";

export type PreferredSynagogue = {
  synagogueId: string;
  minyan?: string | null;
};

export function getPreferredSynagogue(): PreferredSynagogue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreferredSynagogue;
    if (typeof parsed.synagogueId !== "string" || !parsed.synagogueId.trim()) return null;
    return {
      synagogueId: parsed.synagogueId.trim(),
      minyan: typeof parsed.minyan === "string" && parsed.minyan.trim() ? parsed.minyan.trim() : null
    };
  } catch {
    return null;
  }
}

export function setPreferredSynagogue(pref: PreferredSynagogue) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        synagogueId: pref.synagogueId.trim(),
        minyan: pref.minyan?.trim() || null
      })
    );
  } catch {
    /* localStorage unavailable */
  }
}

export function buildDisplayHref(pref: PreferredSynagogue) {
  const params = new URLSearchParams({ synagogueId: pref.synagogueId });
  if (pref.minyan) params.set("minyan", pref.minyan);
  return `/display?${params.toString()}`;
}
