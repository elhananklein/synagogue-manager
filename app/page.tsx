import { DailyHalachaCard } from "@/components/home/daily-halacha-card";
import { PrayerScheduleCard } from "@/components/home/prayer-schedule-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getPublicHomeData } from "@/lib/data/public-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { schedule, halacha } = await getPublicHomeData();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container py-10">
        <section className="mb-8 text-center md:mb-12">
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">ברוכים הבאים לבית כנסת בית רימון</h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            מערכת קהילתית לניהול תפילות, שיעורים ועדכונים שוטפים לציבור המתפללים.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <PrayerScheduleCard items={schedule} />
          <DailyHalachaCard title={halacha.title} text={halacha.text} />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
