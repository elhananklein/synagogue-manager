/** בגרסת הבדיקה — רק בית הכנסת לבדיקות. אחר כך מרחיבים ברשימה או ב־env. */

const DEFAULT_ENABLED = ["synagogue-test"];

export function pushEnabledSynagogueIds(): Set<string> {
  const fromEnv = (process.env.PUSH_ENABLED_SYNAGOGUE_IDS || "")
    .split(/[,;\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  return new Set(fromEnv.length ? fromEnv : DEFAULT_ENABLED);
}

export function isPushNotificationsEnabled(synagogueId: string | null | undefined): boolean {
  if (!synagogueId) return false;
  return pushEnabledSynagogueIds().has(synagogueId);
}
