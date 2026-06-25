import { MobileDisplayRotator } from "@/components/display/mobile-display-rotator";
import { SaveSynagoguePreference } from "@/components/mobile/save-synagogue-preference";
import { buildDisplayView, type DisplayViewParams } from "@/lib/build-display-view";

export const dynamic = "force-dynamic";

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

  return (
    <>
      <SaveSynagoguePreference synagogueId={synagogueId} minyan={minyan} />
      <MobileDisplayRotator
      synagogueName={view.synagogueName}
      minyanName={view.minyanName}
      footerText={view.footerText}
      screens={view.screens}
      dailyLearning={view.dailyLearning}
      snapshot={view.snapshot}
      halacha={view.halacha}
      prayerSchedule={view.prayerSchedule}
      timeSections={view.timeSections}
      shabbat={view.shabbat}
    />
    </>
  );
}
