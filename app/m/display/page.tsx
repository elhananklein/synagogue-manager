import { MobileDisplayRotator } from "@/components/display/mobile-display-rotator";
import { buildDisplayView, type DisplayViewParams } from "@/lib/build-display-view";

export const dynamic = "force-dynamic";

export default async function MobileDisplayPage({
  searchParams
}: {
  searchParams: Promise<DisplayViewParams>;
}) {
  const params = await searchParams;
  const view = await buildDisplayView(params);

  return (
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
  );
}
