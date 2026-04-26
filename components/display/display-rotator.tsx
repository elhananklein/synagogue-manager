"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveClock } from "@/components/display/live-clock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ScreenKey = "main" | "clock" | "halacha";
type DisplayStyle = "classic" | "modern" | "minimal";

type RotatorScreen = {
  screenKey: ScreenKey;
  durationSeconds: number;
  enabled: boolean;
};

type PrayerSlot = {
  label: string;
  time: string;
  details: string;
};

type Snapshot = {
  hebrewDate: string;
  gregorianDate: string;
  parasha: string;
  candleLighting: string | null;
  havdalah: string | null;
  dafYomi: string;
  zmanim: Array<{ label: string; time: string }>;
  rainText: string;
  blessingText: string;
  showYaalehVeyavo: boolean;
};

function styleTokens(style: DisplayStyle) {
  if (style === "modern") {
    return {
      page: "min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white",
      card: "border-indigo-300/40 bg-indigo-500/15 text-slate-100 backdrop-blur",
      row: "border-indigo-300/40 bg-indigo-900/40",
      accent: "text-indigo-100"
    };
  }
  if (style === "minimal") {
    return {
      page: "min-h-screen bg-white text-slate-900",
      card: "border-slate-200 bg-white shadow-none",
      row: "border-slate-300 bg-slate-50",
      accent: "text-slate-500"
    };
  }
  return {
    page: "min-h-screen bg-slate-950 text-slate-100",
    card: "border-slate-700 bg-slate-900",
    row: "border-slate-700 bg-slate-800/60",
    accent: "text-slate-300"
  };
}

export function DisplayRotator({
  style,
  synagogueName,
  minyanName,
  screens,
  snapshot,
  halacha,
  prayerSchedule
}: {
  style: DisplayStyle;
  synagogueName: string;
  minyanName: string | null;
  screens: RotatorScreen[];
  snapshot: Snapshot;
  halacha: { title: string; text: string };
  prayerSchedule: PrayerSlot[];
}) {
  const router = useRouter();
  const enabledScreens = useMemo(() => screens.filter((s) => s.enabled), [screens]);
  const [index, setIndex] = useState(0);
  const tokens = styleTokens(style);

  useEffect(() => {
    if (!enabledScreens.length) return;
    const current = enabledScreens[index % enabledScreens.length];
    const durationMs = Math.max(5, current.durationSeconds) * 1000;
    const timer = setTimeout(() => setIndex((prev) => (prev + 1) % enabledScreens.length), durationMs);
    return () => clearTimeout(timer);
  }, [enabledScreens, index]);

  useEffect(() => {
    // Keep unattended displays up-to-date without full page reload.
    const refreshIntervalMs = 5 * 60 * 1000;
    const intervalId = setInterval(() => {
      router.refresh();
    }, refreshIntervalMs);

    // Force refresh exactly at local midnight (Israel), then continue normal interval refresh.
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const midnightTimeoutMs = Math.max(1000, nextMidnight.getTime() - now.getTime());
    const midnightTimeoutId = setTimeout(() => {
      router.refresh();
    }, midnightTimeoutMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(intervalId);
      clearTimeout(midnightTimeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  if (!enabledScreens.length) {
    return <main className={tokens.page}>אין מסכים פעילים לתצוגה</main>;
  }

  const currentScreen = enabledScreens[index % enabledScreens.length].screenKey;
  const nowJerusalem = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const nowMinutes = nowJerusalem.getHours() * 60 + nowJerusalem.getMinutes();
  const mergedTimes = [
    ...snapshot.zmanim.map((row) => ({ label: row.label, time: row.time, kind: "zman" as const })),
    ...prayerSchedule.map((row) => ({ label: row.label, time: row.time, details: row.details, kind: "prayer" as const }))
  ]
    .map((row) => {
      const [h, m] = row.time.split(":").map(Number);
      return { ...row, totalMinutes: h * 60 + m };
    })
    .sort((a, b) => a.totalMinutes - b.totalMinutes);
  const nextIndex = mergedTimes.findIndex((item) => item.totalMinutes >= nowMinutes);
  const nextSlotIndex = nextIndex === -1 ? 0 : nextIndex;

  return (
    <main className={tokens.page}>
      <div className="mx-auto my-[1.5vh] h-[97vh] w-[97vw] max-w-[97vw] overflow-hidden rounded-2xl border p-4 md:p-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold md:text-4xl">{synagogueName}</h1>
            {minyanName ? <p className={`text-base md:text-lg ${tokens.accent}`}>מניין: {minyanName}</p> : null}
          </div>
          <p className={`text-sm md:text-base ${tokens.accent}`}>
            מסך {index + 1}/{enabledScreens.length}
          </p>
        </header>

        {currentScreen === "clock" ? (
          <section className={`rounded-2xl border p-10 text-center ${tokens.card}`}>
            <LiveClock />
            <p className="mt-5 text-3xl font-semibold md:text-5xl">{snapshot.hebrewDate}</p>
            <p className={`mt-3 text-lg md:text-2xl ${tokens.accent}`}>{snapshot.gregorianDate}</p>
          </section>
        ) : null}

        {currentScreen === "halacha" ? (
          <Card className={tokens.card}>
            <CardHeader>
              <CardTitle className="text-2xl md:text-4xl">{halacha.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl leading-relaxed md:text-3xl">{halacha.text}</p>
            </CardContent>
          </Card>
        ) : null}

        {currentScreen === "main" ? (
          <>
            <section className="grid h-[calc(97vh-170px)] gap-4 md:grid-cols-3">
              <div className="space-y-4">
                <Card className={tokens.card}>
                  <CardHeader>
                    <CardTitle className="text-2xl">פרשת השבוע</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-2xl font-semibold">{snapshot.parasha}</p>
                    <div className={`rounded-md border px-3 py-2 ${tokens.row}`}>כניסת שבת: {snapshot.candleLighting ?? "לא זמין"}</div>
                    <div className={`rounded-md border px-3 py-2 ${tokens.row}`}>יציאת שבת: {snapshot.havdalah ?? "לא זמין"}</div>
                  </CardContent>
                </Card>
                <Card className={tokens.card}>
                  <CardHeader>
                    <CardTitle className="text-2xl">תאריך</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{snapshot.hebrewDate}</p>
                    <p className={`mt-2 text-lg ${tokens.accent}`}>{snapshot.gregorianDate}</p>
                  </CardContent>
                </Card>
                <Card className={tokens.card}>
                  <CardHeader>
                    <CardTitle className="text-2xl">דף יומי</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-semibold">{snapshot.dafYomi}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className={tokens.card}>
                  <CardContent className="grid gap-2 pt-6">
                    <div className={`rounded-md border px-3 py-3 text-xl ${tokens.row}`}>{snapshot.rainText}</div>
                    <div className={`rounded-md border px-3 py-3 text-xl ${tokens.row}`}>{snapshot.blessingText}</div>
                    {snapshot.showYaalehVeyavo ? <div className="rounded-md border border-amber-500 bg-amber-500/20 px-3 py-3 text-xl font-bold">יעלה ויבוא</div> : null}
                  </CardContent>
                </Card>
              </div>

              <Card className={tokens.card}>
                <CardHeader>
                  <CardTitle className="text-2xl">זמני היום ותפילות</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {mergedTimes.map((item, idx) => {
                    const isNext = idx === nextSlotIndex;
                    const isPrayer = item.kind === "prayer";
                    return (
                      <div
                        key={`${item.kind}-${item.label}-${item.time}-${idx}`}
                        className={`rounded-md border px-3 py-2 ${tokens.row} ${
                          isPrayer ? "border-l-4 border-l-emerald-400" : ""
                        } ${isNext ? "scale-[1.02] border-2 border-yellow-300 bg-yellow-300/20" : ""}`}
                      >
                        <div className="flex items-center justify-between text-lg">
                          <span className={isPrayer ? "font-bold" : ""}>{item.label}</span>
                          <span className={`font-bold ${isNext ? "text-yellow-200" : ""}`}>{item.time}</span>
                        </div>
                        {"details" in item && item.details ? <div className={`text-sm ${tokens.accent}`}>{item.details}</div> : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>

            <footer className="mt-3 flex justify-center border-t pt-3">
              <LiveClock />
            </footer>
          </>
        ) : null}
      </div>
    </main>
  );
}

