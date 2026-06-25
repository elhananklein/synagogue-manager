import { DisplayRotator } from "@/components/display/display-rotator";
import { buildDisplayView, type DisplayViewParams } from "@/lib/build-display-view";

export const dynamic = "force-dynamic";

export default async function DisplayPage({
  searchParams
}: {
  searchParams: Promise<DisplayViewParams>;
}) {
  const params = await searchParams;
  const view = await buildDisplayView(params);

  return (
    <DisplayRotator
      style={view.style}
      synagogueId={view.synagogueId}
      synagogueName={view.synagogueName}
      minyanName={view.minyanName}
      footerText={view.footerText}
      scheduleTimesListMode={view.scheduleTimesListMode}
      screens={view.screens}
      dailyLearning={view.dailyLearning}
      snapshot={view.snapshot}
      halacha={view.halacha}
      prayerSchedule={view.prayerSchedule}
      timeSections={view.timeSections}
      shabbat={view.shabbat}
      bulletinItems={view.bulletinItems}
    />
  );
}
