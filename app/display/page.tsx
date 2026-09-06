import type { Metadata } from "next";

import { DisplayRotator } from "@/components/display/display-rotator";
import { DisplayStyleSheet } from "@/components/display/display-style-sheet";
import { PersistDisplaySynagogueCookie } from "@/components/display/persist-display-synagogue-cookie";
import { WallPreviewFrame } from "@/components/display/wall-preview-frame";
import { RedirectHandheldToMobile } from "@/components/mobile/redirect-handheld-to-mobile";
import { buildDisplayView, type DisplayViewParams } from "@/lib/build-display-view";
import { generateDisplayMetadata } from "@/lib/synagogue-public-title";

export const dynamic = "force-dynamic";

function singleParam(value: string | string[] | undefined): string | null {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const s = String(raw ?? "").trim();
  return s.length ? s : null;
}

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<DisplayViewParams>;
}): Promise<Metadata> {
  return generateDisplayMetadata(await searchParams);
}

export default async function DisplayPage({
  searchParams
}: {
  searchParams: Promise<DisplayViewParams & { preview?: string | string[]; embed?: string | string[] }>;
}) {
  const params = await searchParams;
  const previewWall = singleParam(params.preview) === "wall";
  const embed = singleParam(params.embed) === "1";

  if (previewWall && !embed) {
    const synagogueId = singleParam(params.synagogueId) ?? "";
    return (
      <WallPreviewFrame
        backHref={synagogueId ? `/admin/gabbai/${encodeURIComponent(synagogueId)}` : "/admin/gabbai"}
      />
    );
  }

  const view = await buildDisplayView(params);

  return (
    <>
      {previewWall ? null : <RedirectHandheldToMobile wallPath />}
      <PersistDisplaySynagogueCookie synagogueId={view.synagogueId} />
      <DisplayStyleSheet style={view.style} />
      <DisplayRotator
        style={view.style}
        palette={view.palette}
        font={view.font}
        synagogueId={view.synagogueId}
        synagogueName={view.synagogueName}
        minyanName={view.minyanName}
        footerText={view.footerText}
        scheduleTimesListMode={view.scheduleTimesListMode}
        screens={view.screens}
        dailyLearning={view.dailyLearning}
        snapshot={view.snapshot}
        shabbatMevarchimText={view.shabbatMevarchimText}
        halacha={view.halacha}
        prayerSchedule={view.prayerSchedule}
        timeSections={view.timeSections}
        shabbat={view.shabbat}
        bulletinItems={view.bulletinItems}
        disableFullscreen={previewWall}
      />
    </>
  );
}
