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
import { resolveAliyahMessageTemplate } from "@/lib/aliyah-message";
import type { OccasionAgendaDayMeta } from "@/lib/sacred-occasion";
import type { PrayerSetting, PrayerType, ScheduleTimesListMode, ScreenSetting } from "@/lib/gabbai-types";

export type HalachaSettingsModel = {
  startDate: string;
  sourceKey: HalachaSourceKey;
  displayMode: "summary" | "full";
};

export type GabbaiMinyan = {
  id?: string;
  name: string;
  /** קישור לתרומה של המניין. ריק = הקישור הכללי של בית הכנסת */
  donationUrl: string;
  displayStyle: DisplayStyle;
  displayPalette: DisplayPalette;
  displayFont: DisplayFont;
  haftarahMinhag: HaftarahMinhag;
  scheduleTimesListMode: ScheduleTimesListMode;
  scheduleZmanimKeys: string[];
  /** זמנים למסך «לוח זמנים מלא». null = כמו במסך הראשי */
  fullScheduleZmanimKeys: string[] | null;
  /** «לוח זמנים מלא» מציג גם תפילות. false = רק זמני היום */
  fullScheduleShowPrayers: boolean;
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
    donationUrl: "",
    displayStyle: "classic",
    displayPalette: DEFAULT_DISPLAY_PALETTE,
    displayFont: DEFAULT_DISPLAY_FONT,
    haftarahMinhag: DEFAULT_HAFTARAH_MINHAG,
    scheduleTimesListMode: "all",
    scheduleZmanimKeys: [...DEFAULT_SCHEDULE_ZMANIM_KEYS],
    fullScheduleZmanimKeys: null,
    fullScheduleShowPrayers: true,
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
      { screenKey: "fast", sortOrder: 4, durationSeconds: 16, enabled: true },
      { screenKey: "halacha", sortOrder: 5, durationSeconds: 18, enabled: true },
      { screenKey: "dailyLearning", sortOrder: 6, durationSeconds: 22, enabled: false }
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
  if (error === "shabbat_agenda_invalid_day") return "יום לא תקין בלוח השבת";
  if (error && /occasion_day/i.test(error)) {
    return "חסרה תמיכה בימי שבתון במסד. הריצו ב-Supabase את הקובץ supabase/shabbat-agenda-occasion-day-migration.sql";
  }
  if (error === "missing_minyan") return "לא נמצא מניין";
  if (error === "missing_synagogue_name") return "יש למלא את שם בית הכנסת";
  if (error === "invalid_donation_url") return "קישור התרומה לא תקין. העתיקו את הכתובת המלאה מהדפדפן.";
  if (error === "template_missing_opt_out") return "נוסח ההודעה חייב לכלול {קישור_הסרה}";
  if (error === "template_too_long") return "נוסח ההודעה ארוך מדי";
  if (error === "invalid_minyan_donation_url") return "קישור התרומה של אחד המניינים לא תקין. העתיקו את הכתובת המלאה מהדפדפן.";
  if (error === "missing_minyan_donation_column") {
    return "חסר שדה קישור תרומה למניין. הריצו ב-Supabase את הקובץ supabase/minyan-donation-url-migration.sql";
  }
  if (error === "missing_full_schedule_column") {
    return "חסר שדה זמנים ללוח זמנים מלא. הריצו ב-Supabase את הקובץ supabase/full-schedule-zmanim-keys-migration.sql";
  }
  if (error === "missing_full_schedule_prayers_column") {
    return "חסר שדה תפילות ללוח זמנים מלא. הריצו ב-Supabase את הקובץ supabase/full-schedule-show-prayers-migration.sql";
  }
  if (error === "missing_messaging_columns") {
    return "חסרים שדות הודעות לעולים. הריצו ב-Supabase את הקובץ supabase/aliyah-messages-migration.sql";
  }
  if (error && /prayer_type/i.test(error) && /check|invalid/i.test(error)) {
    return "חסרה תמיכה בסליחות במסד. הריצו ב-Supabase את הקובץ supabase/minyan-prayers-selichot-migration.sql";
  }
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
  const [donationUrl, setDonationUrl] = useState("");
  const [aliyahMessageTemplate, setAliyahMessageTemplate] = useState("");
  const [messagingReady, setMessagingReady] = useState(false);
  const [minyanDonationReady, setMinyanDonationReady] = useState(false);
  const [fullScheduleReady, setFullScheduleReady] = useState(false);
  const [fullSchedulePrayersReady, setFullSchedulePrayersReady] = useState(false);
  const [minyanim, setMinyanim] = useState<GabbaiMinyan[]>([]);
  const [halachaSettings, setHalachaSettings] = useState<HalachaSettingsModel>({
    startDate: new Date().toISOString().slice(0, 10),
    sourceKey: "manual",
    displayMode: "summary"
  });
  const [bulletinItems, setBulletinItems] = useState<BulletinItemModel[]>([]);
  const [shabbatParashaHint, setShabbatParashaHint] = useState<string | null>(null);
  const [occasionDays, setOccasionDays] = useState<OccasionAgendaDayMeta[]>([]);
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
          synagogue: {
            name: string;
            logoUrl?: string | null;
            logoUpdatedAt?: string | null;
            donationUrl?: string | null;
            aliyahMessageTemplate?: string | null;
            messagingReady?: boolean;
            minyanDonationReady?: boolean;
            fullScheduleReady?: boolean;
            fullSchedulePrayersReady?: boolean;
          };
          minyanim: GabbaiMinyan[];
          halachaSettings: HalachaSettingsModel;
          bulletinItems?: Parameters<typeof mapBulletinFromApi>[0];
          currentParasha?: string | null;
          occasionDays?: OccasionAgendaDayMeta[];
        };
      };
      if (!payload.ok || !payload.data) {
        setError("לא הצלחנו לטעון את ההגדרות. נסו לרענן.");
        return;
      }
      setSynagogueName(payload.data.synagogue.name);
      setLogoUrl(payload.data.synagogue.logoUrl ?? null);
      setLogoUpdatedAt(payload.data.synagogue.logoUpdatedAt ?? null);
      setDonationUrl(payload.data.synagogue.donationUrl ?? "");
      setAliyahMessageTemplate(resolveAliyahMessageTemplate(payload.data.synagogue.aliyahMessageTemplate));
      setMessagingReady(Boolean(payload.data.synagogue.messagingReady));
      setMinyanDonationReady(Boolean(payload.data.synagogue.minyanDonationReady));
      setFullScheduleReady(Boolean(payload.data.synagogue.fullScheduleReady));
      setFullSchedulePrayersReady(Boolean(payload.data.synagogue.fullSchedulePrayersReady));
      setMinyanim(
        (payload.data.minyanim.length ? payload.data.minyanim : [createDefaultMinyan()]).map((m) => {
          const displayStyle = isDisplayStyle(m.displayStyle) ? m.displayStyle : "classic";
          return {
            ...m,
            displayStyle,
            displayPalette: resolveDisplayPalette(displayStyle, m.displayPalette),
            displayFont: resolveDisplayFont(m.displayFont),
            haftarahMinhag: resolveHaftarahMinhag(m.haftarahMinhag),
            donationUrl: typeof m.donationUrl === "string" ? m.donationUrl : "",
            footerText: typeof m.footerText === "string" ? m.footerText : "",
            scheduleTimesListMode: m.scheduleTimesListMode === "prayers_only" ? "prayers_only" : "all",
            scheduleZmanimKeys: Array.isArray(m.scheduleZmanimKeys)
              ? m.scheduleZmanimKeys
              : [...DEFAULT_SCHEDULE_ZMANIM_KEYS],
            fullScheduleZmanimKeys: Array.isArray(m.fullScheduleZmanimKeys) ? m.fullScheduleZmanimKeys : null,
            fullScheduleShowPrayers: m.fullScheduleShowPrayers !== false,
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
      setOccasionDays(Array.isArray(payload.data.occasionDays) ? payload.data.occasionDays : []);
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
    donationUrl,
    setDonationUrl,
    aliyahMessageTemplate,
    setAliyahMessageTemplate,
    messagingReady,
    minyanDonationReady,
    fullScheduleReady,
    fullSchedulePrayersReady,
    minyanim,
    setMinyanim,
    halachaSettings,
    setHalachaSettings,
    bulletinItems,
    setBulletinItems,
    shabbatParashaHint,
    occasionDays,
    isLoading,
    error,
    reload: load
  };
}
