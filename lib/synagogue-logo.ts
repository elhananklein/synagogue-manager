export const SYNAGOGUE_ICON_SIZES = ["180", "192", "512", "maskable", "watermark"] as const;
export type SynagogueIconSize = (typeof SYNAGOGUE_ICON_SIZES)[number];

export function isSynagogueIconSize(value: string): value is SynagogueIconSize {
  return (SYNAGOGUE_ICON_SIZES as readonly string[]).includes(value);
}

export function synagogueIconSrc(
  synagogueId: string,
  size: SynagogueIconSize,
  version?: string | number | null
) {
  const id = synagogueId.trim().toLowerCase();
  const v = version != null && String(version).trim() ? `?v=${encodeURIComponent(String(version))}` : "";
  return `/m/icon/${id}/${size}${v}`;
}

export function logoCacheVersion(updatedAt?: string | number | null): number | null {
  if (updatedAt == null || updatedAt === "") return null;
  if (typeof updatedAt === "number" && Number.isFinite(updatedAt)) return updatedAt;
  const parsed = Date.parse(String(updatedAt));
  return Number.isFinite(parsed) ? parsed : null;
}

export function synagoguePwaManifestIcons(synagogueId: string, version?: string | number | null) {
  return [
    { src: synagogueIconSrc(synagogueId, "192", version), sizes: "192x192", type: "image/png", purpose: "any" },
    { src: synagogueIconSrc(synagogueId, "512", version), sizes: "512x512", type: "image/png", purpose: "any" },
    {
      src: synagogueIconSrc(synagogueId, "maskable", version),
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable"
    }
  ];
}

export function synagoguePwaMetadataIcons(synagogueId: string, version?: string | number | null) {
  return {
    icon: [
      { url: synagogueIconSrc(synagogueId, "192", version), sizes: "192x192" as const, type: "image/png" },
      { url: synagogueIconSrc(synagogueId, "512", version), sizes: "512x512" as const, type: "image/png" }
    ],
    apple: [{ url: synagogueIconSrc(synagogueId, "180", version), sizes: "180x180" as const, type: "image/png" }]
  };
}
