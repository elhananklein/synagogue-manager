"use client";

import { useCallback, useEffect, useState } from "react";
import { mapBulletinFromApi, type BulletinItemModel } from "@/components/admin/bulletin-board-editor";
import { mapShabbatAgendaFromApi, type ShabbatAgendaItemModel } from "@/components/admin/shabbat-agenda-editor";
import { DEFAULT_DISPLAY_FONT, resolveDisplayFont, type DisplayFont } from "@/lib/display-font";
import {
  DEFAULT_DISPLAY_PALETTE,
  isDisplayStyle,
  resolveDisplayPalette,
  type DisplayPalette,
  type DisplayStyle
} from "@/lib/display-theme";
import { DEFAULT_HAFTARAH_MINHAG, resolveHaftarahMinhag, type HaftarahMinhag } from "@/lib/haftarah-minhag";
import type { HalachaSourceKey } from "@/lib/halacha-source";
import type { ParashaPrayerCatalogRow } from "@/lib/parasha-prayer-catalog";
import { DEFAULT_SCHEDULE_ZMANIM_KEYS } from "@/lib/zmanim-catalog";
import { DEFAULT_DAILY_LEARNING_KEYS, resolveDailyLearningKeys } from "@/lib/daily-learning-catalog";
import type { PrayerSetting, PrayerType, ScheduleTimesListMode, ScreenSetting } from "@/lib/gabbai-types";

export type HalachaSettingsModel = {
  startDate: string;
  sourceKey: HalachaSourceKey;
  displayMode: "summary" | "full";
};

export type GabbaiMinyan = {
  id?: string;
  name: string;
  displayStyle: DisplayStyle;
  displayPalette: DisplayPalette;
  displayFont: DisplayFont;
  haftarahMinhag: HaftarahMinhag;
  scheduleTimesListMode: ScheduleTimesListMode;
  scheduleZmanimKeys: string[];
  dailyLearningKeys: string[];
  footerText: string;
  prayerSettings: PrayerSetting[];
  screens: ScreenSetting[];
  shabbatAgendaItems: ShabbatAgendaItemModel[];
  parashaCatalog: ParashaPrayerCatalogRow[];
};

function newPrayerClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `prayer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function prayerDefaults(category: PrayerSetting["category"]): Omit<PrayerSetting, "prayerType" | "unsaved"> {
  return {
    category,
    daysOfWeek: category === "weekday" ? [0, 1, 2, 3, 4, 5] : [],
    mode: "fixed",
    fixedTime: "08:30",
    zmanAnchor: "sunset",
    offsetMinutes: 0,
    roundMode: "none",
    parashaKey: null,
    lockToSunday: false,
    clientId: newPrayerClientId()
  };
}

export function createPrayer(category: PrayerSetting["category"]): PrayerSetting {
  return {
    ...prayerDefaults(category),
    prayerType: "",
    unsaved: true
  };
}

export function insertPrayerAtCategoryStart(prayers: PrayerSetting[], next: PrayerSetting): PrayerSetting[] {
  const index = prayers.findIndex((p) => p.category === next.category);
  if (index === -1) return [...prayers, next];
  return [...prayers.slice(0, index), next, ...prayers.slice(index)];
}

export function prayersForSave(prayers: PrayerSetting[]) {
  return prayers
    .filter((p): p is PrayerSetting & { prayerType: PrayerType } => Boolean(p.prayerType))
    .map((p) => ({
      category: p.category,
      prayerType: p.prayerType,
      daysOfWeek: p.daysOfWeek,
      mode: p.mode,
      fixedTime: p.fixedTime,
      zmanAnchor: p.zmanAnchor,
      offsetMinutes: p.offsetMinutes,
      roundMode: p.roundMode,
      parashaKey: p.parashaKey,
      lockToSunday: p.lockToSunday
    }));
}

export function createDefaultMinyan(): GabbaiMinyan {
  return {
    name: "",
    displayStyle: "classic",
    displayPalette: DEFAULT_DISPLAY_PALETTE,
    displayFont: DEFAULT_DISPLAY_FONT,
    haftarahMinhag: DEFAULT_HAFTARAH_MINHAG,
    scheduleTimesListMode: "all",
    scheduleZmanimKeys: [...DEFAULT_SCHEDULE_ZMANIM_KEYS],
    dailyLearningKeys: [...DEFAULT_DAILY_LEARNING_KEYS],
    footerText: "",
    prayerSettings: [
      { ...prayerDefaults("weekday"), prayerType: "שחרית" as PrayerType, unsaved: false },
      { ...prayerDefaults("shabbat"), prayerType: "שחרית שבת" as PrayerType, unsaved: false }
    ],
    screens: [
      { screenKey: "main", sortOrder: 1, durationSeconds: 20, enabled: true },
      { screenKey: "clock", sortOrder: 2, durationSeconds: 15, enabled: true },
      { screenKey: "omer", sortOrder: 3, durationSeconds: 12, enabled: true },
      { screenKey: "halacha", sortOrder: 4, durationSeconds: 18, enabled: true },
      { screenKey: "dailyLearning", sortOrder: 5, durationSeconds: 22, enabled: false }
    ],
    shabbatAgendaItems: [],
    parashaCatalog: []
  };
}

function withClientIds(prayers: Array<Omit<PrayerSetting, "clientId" | "unsaved"> & { clientId?: string }>): PrayerSetting[] {
  return prayers.map((p) => ({
    ...p,
    clientId: p.clientId ?? newPrayerClientId(),
    unsaved: false
  }));
}

export function mapGabbaiSaveError(error?: string) {
  if (error === "bulletin_invalid_dates") return "יש למלא תאריכי הצגה תקינים לכל הודעה";
  if (error === "bulletin_until_before_from") return "תאריך «עד» חייב להיות ביום ההתחלה או אחריו";
  if (error === "shabbat_agenda_requires_content") return "יש למלא תוכן בכל שורה בסדר השבת";
  if (error === "shabbat_agenda_invalid_time") return "שעה לא תקינה בסדר השבת";
  if (error === "missing_minyan") return "לא נמצא מניין";
  if (error === "missing_synagogue_name") return "יש למלא את שם בית הכנסת";
  return error ?? "השמירה נכשלה. נסו שוב.";
}

export async function saveGabbaiSection(synagogueId: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return (await response.json()) as { ok: boolean; error?: string };
}

export function useGabbaiWorkspace(synagogueId: string) {
  const [synagogueName, setSynagogueName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUpdatedAt, setLogoUpdatedAt] = useState<string | null>(null);
  const [minyanim, setMinyanim] = useState<GabbaiMinyan[]>([]);
  const [halachaSettings, setHalachaSettings] = useState<HalachaSettingsModel>({
    startDate: new Date().toISOString().slice(0, 10),
    sourceKey: "manual",
    displayMode: "summary"
  });
  const [bulletinItems, setBulletinItems] = useState<BulletinItemModel[]>([]);
  const [shabbatParashaHint, setShabbatParashaHint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!synagogueId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/gabbai/${encodeURIComponent(synagogueId)}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          synagogue: { name: string; logoUrl?: string | null; logoUpdatedAt?: string | null };
          minyanim: GabbaiMinyan[];
          halachaSettings: HalachaSettingsModel;
          bulletinItems?: Parameters<typeof mapBulletinFromApi>[0];
          currentParasha?: string | null;
        };
      };
      if (!payload.ok || !payload.data) {
        setError("לא הצלחנו לטעון את ההגדרות. נסו לרענן.");
        return;
      }
      setSynagogueName(payload.data.synagogue.name);
      setLogoUrl(payload.data.synagogue.logoUrl ?? null);
      setLogoUpdatedAt(payload.data.synagogue.logoUpdatedAt ?? null);
      setMinyanim(
        (payload.data.minyanim.length ? payload.data.minyanim : [createDefaultMinyan()]).map((m) => {
          const displayStyle = isDisplayStyle(m.displayStyle) ? m.displayStyle : "classic";
          return {
            ...m,
            displayStyle,
            displayPalette: resolveDisplayPalette(displayStyle, m.displayPalette),
            displayFont: resolveDisplayFont(m.displayFont),
            haftarahMinhag: resolveHaftarahMinhag(m.haftarahMinhag),
            footerText: typeof m.footerText === "string" ? m.footerText : "",
            scheduleTimesListMode: m.scheduleTimesListMode === "prayers_only" ? "prayers_only" : "all",
            scheduleZmanimKeys: Array.isArray(m.scheduleZmanimKeys)
              ? m.scheduleZmanimKeys
              : [...DEFAULT_SCHEDULE_ZMANIM_KEYS],
            dailyLearningKeys: resolveDailyLearningKeys(m.dailyLearningKeys),
            prayerSettings: withClientIds(m.prayerSettings ?? []),
            screens: [...(m.screens ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => ({ ...s, unsaved: false })),
            shabbatAgendaItems: mapShabbatAgendaFromApi(m.shabbatAgendaItems ?? []),
            parashaCatalog: Array.isArray(m.parashaCatalog) ? m.parashaCatalog : []
          };
        })
      );
      setHalachaSettings(payload.data.halachaSettings);
      setBulletinItems(mapBulletinFromApi(payload.data.bulletinItems ?? []));
      const parasha = payload.data.currentParasha?.trim();
      setShabbatParashaHint(parasha && parasha !== "לא נמצא" ? parasha : null);
    } catch {
      setError("לא הצלחנו לטעון את ההגדרות. נסו לרענן.");
    } finally {
      setIsLoading(false);
    }
  }, [synagogueId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    synagogueName,
    setSynagogueName,
    logoUrl,
    setLogoUrl,
    logoUpdatedAt,
    setLogoUpdatedAt,
    minyanim,
    setMinyanim,
    halachaSettings,
    setHalachaSettings,
    bulletinItems,
    setBulletinItems,
    shabbatParashaHint,
    isLoading,
    error,
    reload: load
  };
}
