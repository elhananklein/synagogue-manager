"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { BulletinBoardEditor, mapBulletinForSave, mapBulletinFromApi, type BulletinItemModel } from "@/components/admin/bulletin-board-editor";
import {
  ShabbatAgendaEditor,
  mapShabbatAgendaForSave,
  mapShabbatAgendaFromApi,
  type ShabbatAgendaItemModel
} from "@/components/admin/shabbat-agenda-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/admin/logout-button";
import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";
import { ParashaPrayerCatalogEditor } from "@/components/admin/parasha-prayer-catalog-editor";
import { DEFAULT_SCHEDULE_ZMANIM_KEYS, ZMANIM_CATALOG } from "@/lib/zmanim-catalog";
import { prayerTypeSortRank } from "@/lib/prayer-order";
import { withParashaCatalogSelectKeys, type ParashaPrayerCatalogRow } from "@/lib/parasha-prayer-catalog";
import { cn } from "@/lib/utils";

type PrayerType = "שחרית" | "מנחה" | "ערבית" | "מנחה ערב שבת" | "שחרית שבת" | "מנחה שבת" | "ערבית מוצ'ש";
type DisplayStyle = "classic" | "modern" | "minimal" | "woodSilver" | "royalBlue";
type ScheduleTimesListMode = "all" | "prayers_only";
type ScreenKey =
  | "main"
  | "mainInfo"
  | "clock"
  | "halacha"
  | "dailyLearning"
  | "prayerTimes"
  | "shabbat"
  | "bulletin"
  | "fullSchedule";
type PrayerMode = "fixed" | "relative" | "parasha";
type PrayerCategory = "weekday" | "shabbat";
type TopTab = "shared" | `minyan-${number}`;
type MinyanInnerTab = "general" | "prayers" | "shabbatAgenda" | "schedule" | "screens";

function mapGabbaiSaveError(error?: string) {
  if (error === "bulletin_invalid_dates") return "יש למלא תאריכי הצגה תקינים לכל הודעה";
  if (error === "bulletin_until_before_from") return "תאריך «עד» חייב להיות ביום ההתחלה או אחריו";
  if (error === "shabbat_agenda_requires_content") return "יש למלא תוכן בכל שורה בלוח הזמנים לשבת";
  if (error === "shabbat_agenda_invalid_time") return "שעה לא תקינה בלוח הזמנים לשבת";
  return error ?? "שמירה נכשלה";
}

type PrayerSetting = {
  category: PrayerCategory;
  prayerType: PrayerType;
  daysOfWeek: number[];
  mode: PrayerMode;
  fixedTime: string | null;
  zmanAnchor: string | null;
  offsetMinutes: number | null;
  roundMode: "none" | "up" | "down";
  parashaKey: string | null;
  lockToSunday: boolean;
  /** מזהה יציב בעורך בלבד */
  clientId: string;
  /** תפילה שנוספה בטופס ועדיין לא נשמרה */
  unsaved?: boolean;
};

type ScreenSetting = {
  screenKey: ScreenKey;
  sortOrder: number;
  durationSeconds: number;
  enabled: boolean;
};

type MinyanModel = {
  id?: string;
  name: string;
  displayStyle: DisplayStyle;
  scheduleTimesListMode: ScheduleTimesListMode;
  scheduleZmanimKeys: string[];
  footerText: string;
  prayerSettings: PrayerSetting[];
  screens: ScreenSetting[];
  shabbatAgendaItems: ShabbatAgendaItemModel[];
  parashaCatalog: ParashaPrayerCatalogRow[];
};

type HalachaSettingsModel = {
  startDate: string;
  sourceKey: "manual" | "kitzur_shulchan_arukh";
  displayMode: "summary" | "full";
};

const WEEKDAY_PRAYERS: PrayerType[] = ["שחרית", "מנחה", "ערבית"];
const SHABBAT_PRAYERS: PrayerType[] = ["מנחה ערב שבת", "שחרית שבת", "מנחה שבת", "ערבית מוצ'ש"];
const ZMAN_ANCHORS = [
  { value: "sunrise", label: "זריחה" },
  { value: "sunset", label: "שקיעה" },
  { value: "chatzot", label: "חצות" },
  { value: "tzeit85deg", label: "צאת הכוכבים" }
];
const SCREEN_OPTIONS: Array<{ key: ScreenKey; label: string }> = [
  { key: "main", label: "מסך ראשי" },
  { key: "mainInfo", label: "מידע מרכזי (מוגדל)" },
  { key: "clock", label: "ספירת העומר" },
  { key: "halacha", label: "הלכה יומית" },
  { key: "dailyLearning", label: "לימוד יומי" },
  { key: "prayerTimes", label: "זמני תפילות" },
  { key: "fullSchedule", label: "לוח זמנים מלא" },
  { key: "shabbat", label: "שבת" },
  { key: "bulletin", label: "לוח מודעות" }
];

const MINYAN_INNER_TABS: Array<{ id: MinyanInnerTab; label: string; shortLabel: string }> = [
  { id: "general", label: "כללי", shortLabel: "כללי" },
  { id: "prayers", label: "זמני תפילות", shortLabel: "תפילות" },
  { id: "shabbatAgenda", label: "לוח זמנים לשבת", shortLabel: "סדר שבת" },
  { id: "schedule", label: "לוח המסך הראשי", shortLabel: "לוח" },
  { id: "screens", label: "מסכי תצוגה", shortLabel: "מסכים" }
];

function nextAvailableScreenKey(screens: ScreenSetting[]): ScreenKey | null {
  const used = new Set(screens.map((s) => s.screenKey));
  return SCREEN_OPTIONS.find((o) => !used.has(o.key))?.key ?? null;
}

function renumberScreens(screens: ScreenSetting[]): ScreenSetting[] {
  return screens.map((screen, index) => ({ ...screen, sortOrder: index + 1 }));
}

function moveScreen(screens: ScreenSetting[], index: number, direction: -1 | 1): ScreenSetting[] {
  const next = index + direction;
  if (next < 0 || next >= screens.length) return screens;
  const copy = [...screens];
  const [row] = copy.splice(index, 1);
  copy.splice(next, 0, row);
  return renumberScreens(copy);
}

const WEEKDAY_OPTIONS = [
  { value: 0, label: "א'" },
  { value: 1, label: "ב'" },
  { value: 2, label: "ג'" },
  { value: 3, label: "ד'" },
  { value: 4, label: "ה'" },
  { value: 5, label: "ו'" },
  { value: 6, label: "שבת" }
];

function newPrayerClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `prayer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createPrayer(category: PrayerCategory): PrayerSetting {
  return {
    category,
    prayerType: category === "weekday" ? "שחרית" : "שחרית שבת",
    daysOfWeek: category === "weekday" ? [0, 1, 2, 3, 4, 5] : [],
    mode: "fixed",
    fixedTime: "08:30",
    zmanAnchor: "sunset",
    offsetMinutes: 0,
    roundMode: "none",
    parashaKey: null,
    lockToSunday: false,
    clientId: newPrayerClientId(),
    unsaved: true
  };
}

function insertPrayerAtCategoryStart(prayers: PrayerSetting[], next: PrayerSetting): PrayerSetting[] {
  const index = prayers.findIndex((p) => p.category === next.category);
  if (index === -1) return [...prayers, next];
  return [...prayers.slice(0, index), next, ...prayers.slice(index)];
}

function prayersForSave(prayers: PrayerSetting[]) {
  const byLogicalOrder = (a: PrayerSetting, b: PrayerSetting) => {
    const rank = prayerTypeSortRank(a.category, a.prayerType) - prayerTypeSortRank(b.category, b.prayerType);
    if (rank !== 0) return rank;
    return Number(Boolean(a.unsaved)) - Number(Boolean(b.unsaved));
  };
  return [
    ...prayers.filter((p) => p.category === "weekday").sort(byLogicalOrder),
    ...prayers.filter((p) => p.category === "shabbat").sort(byLogicalOrder)
  ].map((p) => ({
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

function createDefaultMinyan(): MinyanModel {
  return {
    name: "",
    displayStyle: "classic",
    scheduleTimesListMode: "all",
    scheduleZmanimKeys: [...DEFAULT_SCHEDULE_ZMANIM_KEYS],
    footerText: "",
    prayerSettings: [createPrayer("weekday"), createPrayer("shabbat")],
    screens: [
      { screenKey: "main", sortOrder: 1, durationSeconds: 20, enabled: true },
      { screenKey: "clock", sortOrder: 2, durationSeconds: 12, enabled: true },
      { screenKey: "halacha", sortOrder: 3, durationSeconds: 18, enabled: true },
      { screenKey: "dailyLearning", sortOrder: 4, durationSeconds: 22, enabled: false }
    ],
    shabbatAgendaItems: [],
    parashaCatalog: []
  };
}

function parseTopTab(value: string): TopTab {
  if (value === "shared") return "shared";
  const m = /^minyan-(\d+)$/.exec(value);
  if (m) return `minyan-${Number(m[1])}` as TopTab;
  return "shared";
}

function minyanTabId(index: number): TopTab {
  return `minyan-${index}`;
}

export default function GabbaiSynagoguePage({ params }: { params: Promise<{ synagogueId: string }> }) {
  const [synagogueId, setSynagogueId] = useState("");
  const [synagogueName, setSynagogueName] = useState("");
  const [minyanim, setMinyanim] = useState<MinyanModel[]>([]);
  const [halachaSettings, setHalachaSettings] = useState<HalachaSettingsModel>({
    startDate: new Date().toISOString().slice(0, 10),
    sourceKey: "manual",
    displayMode: "summary"
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteMinyanIndex, setPendingDeleteMinyanIndex] = useState<number | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<1 | 2>(1);
  const [parashaCatalogKeys, setParashaCatalogKeys] = useState<string[]>([]);
  const [bulletinItems, setBulletinItems] = useState<BulletinItemModel[]>([]);
  const [shabbatParashaHint, setShabbatParashaHint] = useState<string | null>(null);
  const [topTab, setTopTab] = useState<TopTab>("shared");
  const [innerTab, setInnerTab] = useState<MinyanInnerTab>("general");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/hebcal/parasha-catalog", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok?: boolean; keys?: string[] }>)
      .then((d) => {
        if (d?.ok && Array.isArray(d.keys)) setParashaCatalogKeys(d.keys);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void params.then((p) => setSynagogueId(p.synagogueId));
  }, [params]);

  async function loadData(id: string) {
    try {
      const response = await fetch(`/api/admin/gabbai/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as {
      ok: boolean;
      data?: {
        synagogue: { id: string; name: string };
        minyanim: Array<
          Omit<MinyanModel, "shabbatAgendaItems"> & {
            shabbatAgendaItems?: Array<{
              id: string;
              sortOrder: number;
              itemTime: string | null;
              content: string;
              published: boolean;
            }>;
            parashaCatalog?: ParashaPrayerCatalogRow[];
          }
        >;
        halachaSettings: HalachaSettingsModel;
        bulletinItems?: Array<{
          id: string;
          kind: "text" | "image";
          title: string | null;
          bodyText: string | null;
          imageUrl: string | null;
          sortOrder: number;
          published: boolean;
          displayFrom: string;
          displayUntil: string;
        }>;
        currentParasha?: string | null;
      };
      error?: string;
    };
    if (!payload.ok || !payload.data) {
      setError(payload.error ?? "טעינת הנתונים נכשלה");
      return;
    }
    setSynagogueName(payload.data.synagogue.name);
    const normalized = (payload.data.minyanim.length ? payload.data.minyanim : [createDefaultMinyan()]).map((m) => ({
      ...m,
      footerText: typeof m.footerText === "string" ? m.footerText : "",
      scheduleTimesListMode: (m.scheduleTimesListMode === "prayers_only" ? "prayers_only" : "all") as ScheduleTimesListMode,
      scheduleZmanimKeys: Array.isArray(m.scheduleZmanimKeys)
        ? m.scheduleZmanimKeys
        : [...DEFAULT_SCHEDULE_ZMANIM_KEYS],
      prayerSettings: m.prayerSettings.map((p) => ({
        ...p,
        mode: (p.mode === "parasha" ? "parasha" : p.mode === "relative" ? "relative" : "fixed") as PrayerMode,
        parashaKey: p.parashaKey ?? null,
        lockToSunday: Boolean(p.lockToSunday),
        roundMode: p.roundMode ?? "none",
        clientId: newPrayerClientId(),
        unsaved: false
      })),
      screens: renumberScreens(
        [...(m.screens ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
      ),
      shabbatAgendaItems: mapShabbatAgendaFromApi(m.shabbatAgendaItems ?? []),
      parashaCatalog: Array.isArray(m.parashaCatalog) ? m.parashaCatalog : []
    }));
    setMinyanim(normalized);
    setHalachaSettings(payload.data.halachaSettings);
    setBulletinItems(mapBulletinFromApi(payload.data.bulletinItems ?? []));
    const parasha = payload.data.currentParasha?.trim();
    setShabbatParashaHint(parasha && parasha !== "לא נמצא" ? parasha : null);
    } catch {
      setError("טעינת הנתונים נכשלה");
    } finally {
      setIsInitialLoading(false);
    }
  }

  useEffect(() => {
    if (!synagogueId) return;
    void loadData(synagogueId);
  }, [synagogueId]);

  // אם נמחק מניין והטאב מצביע עליו — חוזרים לטאב המשותף.
  useEffect(() => {
    if (topTab === "shared") return;
    const idx = Number(topTab.replace("minyan-", ""));
    if (Number.isNaN(idx) || idx < 0 || idx >= minyanim.length) {
      setTopTab("shared");
      setInnerTab("general");
    }
  }, [minyanim.length, topTab]);

  const title = useMemo(() => `ממשק גבאי - ${synagogueName || synagogueId}`, [synagogueId, synagogueName]);

  const topTabItems = useMemo(() => {
    const items = [
      { id: "shared", label: "בית הכנסת", shortLabel: "כללי" },
      ...minyanim.map((m, i) => ({
        id: minyanTabId(i),
        label: m.name.trim() || `מניין ${i + 1}`,
        shortLabel: m.name.trim() || `מניין ${i + 1}`
      }))
    ];
    return items;
  }, [minyanim]);

  const selectedMinyanIndex = topTab.startsWith("minyan-") ? Number(topTab.replace("minyan-", "")) : -1;
  const selectedMinyan = selectedMinyanIndex >= 0 ? minyanim[selectedMinyanIndex] : null;

  function updateMinyan(index: number, updater: (m: MinyanModel) => MinyanModel) {
    setMinyanim((prev) => prev.map((m, i) => (i === index ? updater(m) : m)));
  }

  function addMinyan() {
    const nextIndex = minyanim.length;
    setMinyanim((prev) => [...prev, createDefaultMinyan()]);
    setTopTab(minyanTabId(nextIndex));
    setInnerTab("general");
  }

  const closeDeleteDialog = () => {
    setPendingDeleteMinyanIndex(null);
    setDeleteConfirmStep(1);
  };

  const openDeleteDialog = (minyanIndex: number) => {
    setPendingDeleteMinyanIndex(minyanIndex);
    setDeleteConfirmStep(1);
  };

  const confirmDeleteStepOne = () => setDeleteConfirmStep(2);

  const confirmDeleteStepTwo = () => {
    if (pendingDeleteMinyanIndex == null) return;
    const deleted = pendingDeleteMinyanIndex;
    setMinyanim((prev) => prev.filter((_, i) => i !== deleted));
    setTopTab("shared");
    setInnerTab("general");
    closeDeleteDialog();
  };

  async function saveSettings() {
    if (!synagogueId) return;
    setMessage(null);
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/gabbai/${synagogueId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          synagogueName,
          minyanim: minyanim.map((m) => ({
            ...m,
            prayerSettings: prayersForSave(m.prayerSettings),
            shabbatAgendaItems: mapShabbatAgendaForSave(m.shabbatAgendaItems ?? [])
          })),
          halachaSettings,
          bulletinItems: mapBulletinForSave(bulletinItems)
        })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(mapGabbaiSaveError(payload.error));
        return;
      }
      setMessage("הגדרות נשמרו בהצלחה");
      await loadData(synagogueId);
    } catch {
      setError("שמירה נכשלה");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="container pb-28 pt-6 sm:pb-24 sm:pt-10" aria-busy={isInitialLoading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          {isInitialLoading ? null : (
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              בחרו טאב: הגדרות לכל בית הכנסת, או מניין ספציפי לעריכה.
            </p>
          )}
        </div>
        <LogoutButton />
      </div>

      {isInitialLoading ? (
        <GabbaiLoadingPanel title="טוען את הגדרות בית הכנסת…" />
      ) : (
      <>
      <div className="mt-6">
        <AdminTabs
          items={topTabItems}
          value={topTab}
          onChange={(id) => {
            setTopTab(parseTopTab(id));
            setInnerTab("general");
            setMessage(null);
            setError(null);
          }}
          trailing={
            <Button type="button" variant="outline" size="sm" onClick={addMinyan} className="gap-1">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">הוסף מניין</span>
              <span className="sm:hidden">מניין</span>
            </Button>
          }
        />
      </div>

      <div className="mt-4">
        {topTab === "shared" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>פרטי בית הכנסת</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="block text-sm font-medium">שם בית הכנסת</label>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background px-3"
                  value={synagogueName}
                  onChange={(e) => setSynagogueName(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">השם ישמש בכותרת המערכת (לפי בית הכנסת הפעיל).</p>
                <Button type="button" variant="outline" asChild>
                  <a href={`/display?synagogueId=${synagogueId}`}>פתח מסך תצוגה</a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>הגדרות הלכה יומית</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">תאריך התחלה</label>
                  <input
                    type="date"
                    className="h-10 w-full rounded-md border border-border bg-background px-3"
                    value={halachaSettings.startDate}
                    onChange={(e) => setHalachaSettings((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">מקור הלכה</label>
                  <select
                    className="h-10 w-full rounded-md border border-border bg-background px-3"
                    value={halachaSettings.sourceKey}
                    onChange={(e) =>
                      setHalachaSettings((prev) => ({
                        ...prev,
                        sourceKey: e.target.value as "manual" | "kitzur_shulchan_arukh"
                      }))
                    }
                  >
                    <option value="manual">הלכות שהוזנו ידנית (מפתח manual)</option>
                    <option value="kitzur_shulchan_arukh">קיצור שולחן ערוך (שורות בטבלה בלבד, ללא משיכה מהרשת)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">אופן תצוגה</label>
                  <select
                    className="h-10 w-full rounded-md border border-border bg-background px-3"
                    value={halachaSettings.displayMode}
                    onChange={(e) =>
                      setHalachaSettings((prev) => ({
                        ...prev,
                        displayMode: e.target.value as "summary" | "full"
                      }))
                    }
                  >
                    <option value="summary">תקציר</option>
                    <option value="full">מלא</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <BulletinBoardEditor synagogueId={synagogueId} items={bulletinItems} onChange={setBulletinItems} />
          </div>
        ) : selectedMinyan ? (
          <Card>
            <CardHeader className="space-y-3 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg sm:text-xl">
                  {selectedMinyan.name.trim() || `מניין ${selectedMinyanIndex + 1}`}
                </CardTitle>
                {selectedMinyan.id ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={`/display?synagogueId=${encodeURIComponent(synagogueId)}&minyan=${selectedMinyanIndex + 1}`}
                      title="מספר לפי סדר ברשימה (1 = ראשון)."
                    >
                      פתח תצוגה
                    </a>
                  </Button>
                ) : null}
              </div>
              <AdminTabs
                items={MINYAN_INNER_TABS}
                value={innerTab}
                onChange={(id) => setInnerTab(id as MinyanInnerTab)}
              />
            </CardHeader>
            <CardContent className="pt-2">
              {innerTab === "general" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">שם המניין</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3"
                      value={selectedMinyan.name}
                      onChange={(e) =>
                        updateMinyan(selectedMinyanIndex, (m) => ({ ...m, name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">סגנון תצוגה</label>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-background px-3"
                      value={selectedMinyan.displayStyle}
                      onChange={(e) =>
                        updateMinyan(selectedMinyanIndex, (m) => ({
                          ...m,
                          displayStyle: e.target.value as DisplayStyle
                        }))
                      }
                    >
                      <option value="classic">קלאסי</option>
                      <option value="modern">מודרני</option>
                      <option value="minimal">מינימלי</option>
                      <option value="woodSilver">עץ וכסף</option>
                      <option value="royalBlue">כחול מלכותי</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium">הודעה בתחתית המסך</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3"
                      value={selectedMinyan.footerText}
                      maxLength={120}
                      placeholder="לדוגמה: ברוכים הבאים לבית הכנסת"
                      onChange={(e) =>
                        updateMinyan(selectedMinyanIndex, (m) => ({ ...m, footerText: e.target.value }))
                      }
                    />
                    <p className="mt-1 text-xs text-muted-foreground">שורה אחת לכל היותר, מוצגת בתחתית כל המסכים.</p>
                  </div>
                  <div className="sm:col-span-2 border-t border-border pt-4">
                    <Button type="button" variant="outline" onClick={() => openDeleteDialog(selectedMinyanIndex)}>
                      מחק מניין
                    </Button>
                  </div>
                </div>
              ) : null}

              {innerTab === "shabbatAgenda" ? (
                <ShabbatAgendaEditor
                  items={selectedMinyan.shabbatAgendaItems}
                  onChange={(items) =>
                    updateMinyan(selectedMinyanIndex, (m) => ({ ...m, shabbatAgendaItems: items }))
                  }
                  parashaHint={shabbatParashaHint}
                />
              ) : null}

              {innerTab === "prayers" ? (
                <div className="space-y-6">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">תפילות ימי חול</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateMinyan(selectedMinyanIndex, (m) => ({
                            ...m,
                            prayerSettings: insertPrayerAtCategoryStart(m.prayerSettings, createPrayer("weekday"))
                          }))
                        }
                      >
                        הוספת תפילה
                      </Button>
                    </div>
                    {selectedMinyan.prayerSettings.map((setting, prayerIndex) =>
                      setting.category === "weekday" ? (
                        <PrayerEditor
                          key={setting.clientId}
                          setting={setting}
                          prayerOptions={WEEKDAY_PRAYERS}
                          parashaCatalogKeys={parashaCatalogKeys}
                          showDaysOfWeek
                          onChange={(next) =>
                            updateMinyan(selectedMinyanIndex, (m) => ({
                              ...m,
                              prayerSettings: m.prayerSettings.map((p, j) => (j === prayerIndex ? next : p))
                            }))
                          }
                          onDelete={() =>
                            updateMinyan(selectedMinyanIndex, (m) => ({
                              ...m,
                              prayerSettings: m.prayerSettings.filter((_, j) => j !== prayerIndex)
                            }))
                          }
                        />
                      ) : null
                    )}
                  </div>

                  <ParashaPrayerCatalogEditor
                    key={selectedMinyan.id ?? "new-minyan"}
                    synagogueId={synagogueId}
                    minyanId={selectedMinyan.id}
                    parashaKeys={parashaCatalogKeys}
                    savedRows={selectedMinyan.parashaCatalog}
                  />

                  <div className="border-t border-border pt-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">תפילות שבת</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateMinyan(selectedMinyanIndex, (m) => ({
                            ...m,
                            prayerSettings: insertPrayerAtCategoryStart(m.prayerSettings, createPrayer("shabbat"))
                          }))
                        }
                      >
                        הוספת תפילת שבת
                      </Button>
                    </div>
                    {selectedMinyan.prayerSettings.map((setting, prayerIndex) =>
                      setting.category === "shabbat" ? (
                        <PrayerEditor
                          key={setting.clientId}
                          setting={setting}
                          prayerOptions={SHABBAT_PRAYERS}
                          onChange={(next) =>
                            updateMinyan(selectedMinyanIndex, (m) => ({
                              ...m,
                              prayerSettings: m.prayerSettings.map((p, j) => (j === prayerIndex ? next : p))
                            }))
                          }
                          onDelete={() =>
                            updateMinyan(selectedMinyanIndex, (m) => ({
                              ...m,
                              prayerSettings: m.prayerSettings.filter((_, j) => j !== prayerIndex)
                            }))
                          }
                        />
                      ) : null
                    )}
                  </div>
                </div>
              ) : null}

              {innerTab === "schedule" ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">לוח זמנים במסך הראשי</label>
                    <select
                      className="h-10 w-full max-w-md rounded-md border border-border bg-background px-3"
                      value={selectedMinyan.scheduleTimesListMode}
                      onChange={(e) =>
                        updateMinyan(selectedMinyanIndex, (m) => ({
                          ...m,
                          scheduleTimesListMode: e.target.value as ScheduleTimesListMode
                        }))
                      }
                    >
                      <option value="all">כל הזמנים (זמני היום + תפילות)</option>
                      <option value="prayers_only">רק זמני תפילות</option>
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      משפיע על כרטיס &quot;זמני היום ותפילות&quot; במסך הראשי בלבד.
                    </p>
                  </div>

                  {selectedMinyan.scheduleTimesListMode !== "prayers_only" ? (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold">זמני היום להצגה במסך הראשי</h3>
                          <p className="text-xs text-muted-foreground">
                            בחרו אילו זמנים הלכתיים יוצגו בלוח, מעבר לזמני התפילות.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateMinyan(selectedMinyanIndex, (m) => ({
                                ...m,
                                scheduleZmanimKeys: ZMANIM_CATALOG.map((z) => z.key)
                              }))
                            }
                          >
                            בחר הכל
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateMinyan(selectedMinyanIndex, (m) => ({ ...m, scheduleZmanimKeys: [] }))
                            }
                          >
                            נקה
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {ZMANIM_CATALOG.map((zman) => {
                          const checked = selectedMinyan.scheduleZmanimKeys.includes(zman.key);
                          return (
                            <label
                              key={zman.key}
                              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  updateMinyan(selectedMinyanIndex, (m) => ({
                                    ...m,
                                    scheduleZmanimKeys: e.target.checked
                                      ? [...m.scheduleZmanimKeys, zman.key]
                                      : m.scheduleZmanimKeys.filter((k) => k !== zman.key)
                                  }))
                                }
                              />
                              {zman.label}
                            </label>
                          );
                        })}
                      </div>
                      {selectedMinyan.scheduleZmanimKeys.length === 0 ? (
                        <p className="mt-2 text-xs text-amber-600">לא נבחרו זמני יום — יוצגו זמני התפילות בלבד.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {innerTab === "screens" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">מסכים מתחלפים בתצוגה</h3>
                      <p className="text-xs text-muted-foreground">
                        הפעלה ומשך הצגה. סדר ההופעה לפי סדר השורות — העלו או הורידו שורה.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!nextAvailableScreenKey(selectedMinyan.screens)}
                      onClick={() => {
                        const key = nextAvailableScreenKey(selectedMinyan.screens);
                        if (!key) return;
                        updateMinyan(selectedMinyanIndex, (m) => ({
                          ...m,
                          screens: [
                            ...m.screens,
                            {
                              screenKey: key,
                              sortOrder: m.screens.length + 1,
                              durationSeconds: 20,
                              enabled: true
                            }
                          ]
                        }));
                      }}
                    >
                      הוסף מסך
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {selectedMinyan.screens.map((screen, screenIndex) => (
                      <div
                        key={`${screen.screenKey}-${screenIndex}`}
                        className="space-y-2 rounded-md border border-border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">מסך {screenIndex + 1}</span>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={screenIndex === 0}
                              onClick={() =>
                                updateMinyan(selectedMinyanIndex, (m) => ({
                                  ...m,
                                  screens: moveScreen(m.screens, screenIndex, -1)
                                }))
                              }
                            >
                              ↑
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={screenIndex === selectedMinyan.screens.length - 1}
                              onClick={() =>
                                updateMinyan(selectedMinyanIndex, (m) => ({
                                  ...m,
                                  screens: moveScreen(m.screens, screenIndex, 1)
                                }))
                              }
                            >
                              ↓
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateMinyan(selectedMinyanIndex, (m) => ({
                                  ...m,
                                  screens: renumberScreens(m.screens.filter((_, j) => j !== screenIndex))
                                }))
                              }
                            >
                              הסר
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_auto_5rem]">
                          <select
                            className="h-10 w-full rounded-md border border-border bg-background px-3"
                            aria-label="סוג מסך"
                            value={screen.screenKey}
                            onChange={(e) => {
                              const nextKey = e.target.value as ScreenKey;
                              updateMinyan(selectedMinyanIndex, (m) => ({
                                ...m,
                                screens: m.screens.map((s, j) =>
                                  j === screenIndex ? { ...s, screenKey: nextKey } : s
                                )
                              }));
                            }}
                          >
                            {SCREEN_OPTIONS.map((opt) => {
                              const takenByOther = selectedMinyan.screens.some(
                                (s, j) => j !== screenIndex && s.screenKey === opt.key
                              );
                              return (
                                <option key={opt.key} value={opt.key} disabled={takenByOther}>
                                  {opt.label}
                                </option>
                              );
                            })}
                          </select>
                          <label className="inline-flex h-10 items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={screen.enabled}
                              onChange={(e) =>
                                updateMinyan(selectedMinyanIndex, (m) => ({
                                  ...m,
                                  screens: m.screens.map((s, j) =>
                                    j === screenIndex ? { ...s, enabled: e.target.checked } : s
                                  )
                                }))
                              }
                            />
                            פעיל
                          </label>
                          <div>
                            <label className="mb-0.5 block text-[11px] text-muted-foreground">שניות</label>
                            <input
                              type="number"
                              className="h-10 w-full rounded-md border border-border bg-background px-2"
                              value={screen.durationSeconds}
                              onChange={(e) =>
                                updateMinyan(selectedMinyanIndex, (m) => ({
                                  ...m,
                                  screens: m.screens.map((s, j) =>
                                    j === screenIndex
                                      ? { ...s, durationSeconds: Number(e.target.value) }
                                      : s
                                  )
                                }))
                              }
                            />
                          </div>
                        </div>
                        {screen.screenKey === "clock" ? (
                          <p className="text-[11px] text-muted-foreground">
                            מוצג בסיבוב רק בימי ספירת העומר, גם אם מסומן כפעיל.
                          </p>
                        ) : null}
                      </div>
                    ))}
                    {!selectedMinyan.screens.length ? (
                      <p className="text-sm text-muted-foreground">אין מסכים. הוסיפו מסך כדי להתחיל.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
      </>
      )}

      {isInitialLoading ? null : (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex flex-wrap items-center gap-2 py-3 sm:gap-3">
          <Button type="button" onClick={() => void saveSettings()} disabled={isSaving} className="min-w-[8rem]">
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                שומר...
              </span>
            ) : (
              "שמור הכל"
            )}
          </Button>
          {message ? <span className="text-sm text-green-600">{message}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </div>
      )}

      {pendingDeleteMinyanIndex != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-bold">
              {deleteConfirmStep === 1 ? "האם אתה בטוח? פעולה זו אינה הפיכה" : "המניין יימחק לצמיתות"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {deleteConfirmStep === 1
                ? "המערכת תעבור לשלב אישור נוסף לפני המחיקה בפועל."
                : "רק לחיצה על אישור תמחק את המניין מהמסך הנוכחי. יש לשמור כדי להחיל בשרת."}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDeleteDialog}>
                ביטול
              </Button>
              {deleteConfirmStep === 1 ? (
                <Button type="button" variant="outline" onClick={confirmDeleteStepOne}>
                  כן, אני בטוח
                </Button>
              ) : (
                <Button type="button" onClick={confirmDeleteStepTwo}>
                  אישור
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PrayerEditor({
  setting,
  prayerOptions,
  onChange,
  onDelete,
  showDaysOfWeek = false,
  parashaCatalogKeys = []
}: {
  setting: PrayerSetting;
  prayerOptions: PrayerType[];
  onChange: (next: PrayerSetting) => void;
  onDelete: () => void;
  showDaysOfWeek?: boolean;
  parashaCatalogKeys?: string[];
}) {
  const currentOffset = setting.offsetMinutes ?? 0;
  const direction: "before" | "after" = currentOffset < 0 ? "before" : "after";
  const absoluteMinutes = Math.abs(currentOffset);

  return (
    <div
      className={cn(
        "mb-3 rounded-md p-3",
        setting.unsaved
          ? "border-2 border-dashed border-primary bg-primary/5 shadow-sm"
          : "border border-border"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex flex-wrap items-center gap-2 text-sm font-medium",
            setting.unsaved ? "text-primary" : "text-muted-foreground"
          )}
        >
          {setting.unsaved ? (
            <>
              <span className="font-semibold">תפילה חדשה</span>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium">טרם נשמרה</span>
            </>
          ) : (
            "הגדרת תפילה"
          )}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onDelete}>
          מחק
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <select
          className="h-10 min-w-[7rem] flex-1 rounded-md border border-border bg-background px-3 sm:flex-none"
          value={setting.prayerType}
          onChange={(e) => {
            const prayerType = e.target.value as PrayerType;
            const canAnchorToMincha = prayerType === "ערבית" || prayerType === "ערבית מוצ'ש";
            onChange({
              ...setting,
              prayerType,
              lockToSunday:
                prayerType === "מנחה" || prayerType === "ערבית" ? setting.lockToSunday : false,
              zmanAnchor:
                setting.zmanAnchor === "mincha" && !canAnchorToMincha ? "sunset" : setting.zmanAnchor
            });
          }}
        >
          {prayerOptions.map((option) => (
            <option key={option} value={option}>
              {option === "מנחה ערב שבת" ? "מנחה ערב שבת וקבלת שבת" : option}
            </option>
          ))}
        </select>
        <select
          className="h-10 min-w-[9.5rem] flex-1 rounded-md border border-border bg-background px-3 sm:flex-none"
          value={setting.mode}
          onChange={(e) => {
            const mode = e.target.value as PrayerMode;
            if (!showDaysOfWeek && mode === "parasha") return;
            const next: PrayerSetting = { ...setting, mode };
            if (mode === "parasha") {
              next.zmanAnchor = null;
              next.offsetMinutes = 0;
              next.roundMode = "none";
              next.lockToSunday = false;
              if (setting.prayerType === "מנחה" || setting.prayerType === "ערבית") {
                next.parashaKey = setting.parashaKey?.trim() ? setting.parashaKey : null;
                next.fixedTime = setting.parashaKey?.trim() ? (setting.fixedTime ?? "12:00") : null;
              } else {
                next.parashaKey = (setting.parashaKey?.trim() || parashaCatalogKeys[0] || "").trim() || null;
                next.fixedTime = setting.fixedTime ?? "12:00";
              }
            } else if (mode === "fixed") {
              next.parashaKey = null;
              next.zmanAnchor = null;
              next.offsetMinutes = null;
              next.roundMode = "none";
              next.lockToSunday = false;
            } else {
              next.parashaKey = null;
              next.zmanAnchor = setting.zmanAnchor ?? "sunset";
              next.offsetMinutes = setting.offsetMinutes ?? 0;
              next.roundMode = setting.roundMode ?? "none";
            }
            onChange(next);
          }}
        >
          <option value="fixed">זמן קבוע</option>
          <option value="relative">יחסית לזמן יום</option>
          {showDaysOfWeek ? <option value="parasha">לפי פרשה (א׳–ה׳)</option> : null}
        </select>
        {setting.mode === "fixed" ? (
          <input
            type="time"
            className="h-10 rounded-md border border-border bg-background px-3"
            value={setting.fixedTime ?? ""}
            onChange={(e) => onChange({ ...setting, fixedTime: e.target.value })}
          />
        ) : null}
        {setting.mode === "parasha" ? (
          <>
            <select
              className="h-10 min-w-[12rem] max-w-full flex-1 rounded-md border border-border bg-background px-2 text-sm"
              value={setting.parashaKey ?? ""}
              onChange={(e) => {
                const parashaKey = e.target.value || null;
                onChange({
                  ...setting,
                  parashaKey,
                  fixedTime: parashaKey ? (setting.fixedTime ?? "12:00") : null
                });
              }}
            >
              {setting.prayerType === "מנחה" || setting.prayerType === "ערבית" ? (
                <option value="">קטלוג שנתי (טבלת הפרשות)</option>
              ) : (
                <option value="">בחר פרשה…</option>
              )}
              {withParashaCatalogSelectKeys(parashaCatalogKeys).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            {setting.parashaKey ? (
              <input
                type="time"
                className="h-10 rounded-md border border-border bg-background px-3"
                value={setting.fixedTime ?? ""}
                onChange={(e) => onChange({ ...setting, fixedTime: e.target.value })}
              />
            ) : null}
          </>
        ) : null}
        {setting.mode === "relative" ? (
          <>
            <select
              className="h-10 min-w-[8rem] rounded-md border border-border bg-background px-3"
              value={setting.zmanAnchor ?? "sunset"}
              onChange={(e) => onChange({ ...setting, zmanAnchor: e.target.value })}
            >
              {(setting.prayerType === "ערבית" || setting.prayerType === "ערבית מוצ'ש"
                ? [...ZMAN_ANCHORS, { value: "mincha", label: "תפילת מנחה" }]
                : ZMAN_ANCHORS
              ).map((anchor) => (
                <option key={anchor.value} value={anchor.value}>
                  {anchor.label}
                </option>
              ))}
            </select>
            <select
              className="h-10 min-w-[5rem] rounded-md border border-border bg-background px-3"
              value={direction}
              onChange={(e) =>
                onChange({
                  ...setting,
                  offsetMinutes: e.target.value === "before" ? -absoluteMinutes : absoluteMinutes
                })
              }
            >
              <option value="before">לפני</option>
              <option value="after">אחרי</option>
            </select>
            <input
              type="number"
              min={0}
              className="h-10 w-20 rounded-md border border-border bg-background px-3"
              value={absoluteMinutes}
              onChange={(e) =>
                onChange({
                  ...setting,
                  offsetMinutes: direction === "before" ? -Number(e.target.value) : Number(e.target.value)
                })
              }
              placeholder="דקות"
            />
            <select
              className="h-10 min-w-[7rem] rounded-md border border-border bg-background px-2 text-sm"
              value={setting.roundMode ?? "none"}
              onChange={(e) =>
                onChange({
                  ...setting,
                  roundMode: e.target.value as "none" | "up" | "down"
                })
              }
            >
              <option value="none">ללא עיגול</option>
              <option value="up">עיגול למעלה (5 דק&#39;)</option>
              <option value="down">עיגול למטה (5 דק&#39;)</option>
            </select>
          </>
        ) : null}
      </div>
      {setting.mode === "relative" && setting.zmanAnchor === "mincha" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          מחושב לפי זמן תפילת המנחה שמוצג באותו יום. אם אין מנחה — ערבית לא תוצג.
        </p>
      ) : null}
      {showDaysOfWeek &&
      setting.mode === "relative" &&
      (setting.prayerType === "מנחה" || setting.prayerType === "ערבית") ? (
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(setting.lockToSunday)}
            onChange={(e) => onChange({ ...setting, lockToSunday: e.target.checked })}
          />
          <span>
            זמן קבוע לפי יום ראשון לכל השבוע
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {setting.zmanAnchor === "mincha"
                ? "גם אם זמן המנחה זז בימים הבאים, יוצג זמן הערבית לפי מנחה של יום ראשון (כולל היסט ועיגול)."
                : "גם אם השקיעה או צאת הכוכבים זזים בימים הבאים, יוצג זמן התפילה שחושב לפי יום ראשון (כולל היסט ועיגול)."}
            </span>
          </span>
        </label>
      ) : null}
      {showDaysOfWeek && setting.mode === "parasha" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {setting.parashaKey
            ? "בשבוע של הפרשה הנבחרת, בימים א׳–ה׳ בלבד: זמן זה מחליף כל הגדרות אחרות לאותה תפילה, כולל הקטלוג. שישי ושבת ללא שינוי."
            : "בימים א׳–ה׳: השעה תילקח מטבלת הפרשות של המניין. אם אין שעה לפרשה (או לחול המועד) השבוע — יישאר הכלל הרגיל. שישי ושבת ללא שינוי."}
        </p>
      ) : null}
      {showDaysOfWeek ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAY_OPTIONS.map((day) => (
            <label key={day.value} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={setting.daysOfWeek.includes(day.value)}
                onChange={(e) =>
                  onChange({
                    ...setting,
                    daysOfWeek: e.target.checked
                      ? [...setting.daysOfWeek, day.value]
                      : setting.daysOfWeek.filter((d) => d !== day.value)
                  })
                }
              />
              {day.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
