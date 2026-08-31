"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DisplayView } from "@/lib/build-display-view";

/** אם אין תשובה עד אז — מוותרים ומשאירים את התצוגה הקיימת. */
export const DISPLAY_LIVE_TIMEOUT_MS = 15_000;
/** ריענון רקע; לא מפרק את הדף. */
export const DISPLAY_LIVE_INTERVAL_MS = 30 * 60 * 1000;

type DisplayLivePayload = {
  ok?: boolean;
  view?: DisplayView;
};

export function pickDisplayLiveFields(view: DisplayView) {
  return {
    synagogueId: view.synagogueId,
    synagogueName: view.synagogueName,
    minyanName: view.minyanName,
    font: view.font,
    footerText: view.footerText ?? null,
    scheduleTimesListMode: view.scheduleTimesListMode,
    screens: view.screens,
    dailyLearning: view.dailyLearning,
    snapshot: view.snapshot,
    shabbatMevarchimText: view.shabbatMevarchimText,
    halacha: view.halacha,
    prayerSchedule: view.prayerSchedule,
    timeSections: view.timeSections,
    timeSectionsAll: view.timeSectionsAll,
    viewDate: view.viewDate,
    shabbat: view.shabbat,
    bulletinItems: view.bulletinItems
  };
}

export async function fetchDisplayLiveView(
  timeoutMs = DISPLAY_LIVE_TIMEOUT_MS,
  extraParams?: Record<string, string | null | undefined>
): Promise<DisplayView | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL("/api/display", window.location.origin);
    url.search = window.location.search;
    if (extraParams) {
      for (const [key, value] of Object.entries(extraParams)) {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      }
    }
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DisplayLivePayload;
    if (!data?.ok || !data.view) return null;
    return data.view;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** ריענון נתונים בלי ניווט. כישלון = לא נוגעים במסך. */
export function useDisplayLiveRefresh(apply: (view: DisplayView) => void) {
  const inFlightRef = useRef(false);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const refreshLive = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const view = await fetchDisplayLiveView();
      if (view) applyRef.current(view);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshLive();
    }, DISPLAY_LIVE_INTERVAL_MS);

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const midnightId = window.setTimeout(() => {
      void refreshLive();
    }, Math.max(1000, nextMidnight.getTime() - now.getTime()));

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshLive();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(midnightId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [refreshLive]);

  return refreshLive;
}

export function useHalachicDayLiveRefresh(iso: string | null | undefined, refreshLive: () => void) {
  useEffect(() => {
    if (!iso) return;
    const delay = new Date(iso).getTime() - Date.now();
    if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
    const id = window.setTimeout(() => refreshLive(), delay);
    return () => window.clearTimeout(id);
  }, [iso, refreshLive]);
}
