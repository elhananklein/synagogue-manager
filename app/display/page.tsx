import type { Metadata } from "next";

import { DisplayRotator } from "@/components/display/display-rotator";
import { DisplayStyleSheet } from "@/components/display/display-style-sheet";
import { PersistDisplaySynagogueCookie } from "@/components/display/persist-display-synagogue-cookie";
import { RedirectHandheldToMobile } from "@/components/mobile/redirect-handheld-to-mobile";
import { buildDisplayView, type DisplayViewParams } from "@/lib/build-display-view";
import { generateDisplayMetadata } from "@/lib/synagogue-public-title";

export const dynamic = "force-dynamic";

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
  searchParams: Promise<DisplayViewParams>;
}) {
  const params = await searchParams;
  const view = await buildDisplayView(params);

  return (
    <>
      <RedirectHandheldToMobile wallPath />
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
      />
    </>
  );
}
