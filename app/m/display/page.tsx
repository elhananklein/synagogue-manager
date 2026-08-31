import type { Metadata } from "next";

import { MobileDisplayRotator } from "@/components/display/mobile-display-rotator";
import { SaveSynagoguePreference } from "@/components/mobile/save-synagogue-preference";
import { buildDisplayView, type DisplayViewParams } from "@/lib/build-display-view";
import { listActiveMinyanim, resolveMinyanOrdinal } from "@/lib/display-config";
import { generateDisplayMetadata } from "@/lib/synagogue-public-title";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<DisplayViewParams>;
}): Promise<Metadata> {
  return generateDisplayMetadata(await searchParams);
}

function singleParam(value: string | string[] | undefined): string | null {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const s = String(raw ?? "").trim();
  return s.length ? s : null;
}

export default async function MobileDisplayPage({
  searchParams
}: {
  searchParams: Promise<DisplayViewParams>;
}) {
  const params = await searchParams;
  const view = await buildDisplayView(params);
  const synagogueId = singleParam(params.synagogueId);
  const minyan = singleParam(params.minyan) ?? singleParam(params.minyanId);
  const minyanOptions = synagogueId ? await listActiveMinyanim(synagogueId) : [];
  const currentMinyanIndex = resolveMinyanOrdinal(minyanOptions, minyan, view.minyanName);

  return (
    <>
      <SaveSynagoguePreference synagogueId={synagogueId} minyan={minyan} />
      <MobileDisplayRotator
      synagogueId={synagogueId}
      synagogueName={view.synagogueName}
      minyanName={view.minyanName}
      minyanOptions={minyanOptions}
      currentMinyanIndex={currentMinyanIndex}
      font={view.font}
      footerText={view.footerText}
      screens={view.screens}
      dailyLearning={view.dailyLearning}
      snapshot={view.snapshot}
      shabbatMevarchimText={view.shabbatMevarchimText}
      halacha={view.halacha}
      prayerSchedule={view.prayerSchedule}
      timeSections={view.timeSections}
      timeSectionsAll={view.timeSectionsAll}
      viewDate={view.viewDate}
      scheduleTimesListMode={view.scheduleTimesListMode}
      shabbat={view.shabbat}
      bulletinItems={view.bulletinItems}
    />
    </>
  );
}
