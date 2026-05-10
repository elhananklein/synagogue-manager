"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PrayerType = "שחרית" | "מנחה" | "ערבית" | "מנחה ערב שבת" | "שחרית שבת" | "מנחה שבת" | "ערבית מוצ\"ש";
type DisplayStyle = "classic" | "modern" | "minimal" | "woodSilver";
type ScreenKey = "main" | "clock" | "halacha" | "dailyLearning";
type PrayerMode = "fixed" | "relative";
type PrayerCategory = "weekday" | "shabbat";

type PrayerSetting = {
  category: PrayerCategory;
  prayerType: PrayerType;
  daysOfWeek: number[];
  mode: PrayerMode;
  fixedTime: string | null;
  zmanAnchor: string | null;
  offsetMinutes: number | null;
  roundMode: "none" | "up" | "down";
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
  prayerSettings: PrayerSetting[];
  screens: ScreenSetting[];
};

type HalachaSettingsModel = {
  startDate: string;
  sourceKey: "kitzur_shulchan_arukh";
  displayMode: "summary" | "full";
};

const WEEKDAY_PRAYERS: PrayerType[] = ["שחרית", "מנחה", "ערבית"];
const SHABBAT_PRAYERS: PrayerType[] = ["מנחה ערב שבת", "שחרית שבת", "מנחה שבת", "ערבית מוצ\"ש"];
const ZMAN_ANCHORS = [
  { value: "sunrise", label: "זריחה" },
  { value: "sunset", label: "שקיעה" },
  { value: "chatzot", label: "חצות" },
  { value: "tzeit85deg", label: "צאת הכוכבים" }
];
const SCREEN_OPTIONS: Array<{ key: ScreenKey; label: string }> = [
  { key: "main", label: "מסך ראשי" },
  { key: "clock", label: "תאריך ושעה" },
  { key: "halacha", label: "הלכה יומית" },
  { key: "dailyLearning", label: "לימוד יומי" }
];

function nextAvailableScreenKey(screens: ScreenSetting[]): ScreenKey | null {
  const used = new Set(screens.map((s) => s.screenKey));
  const next = SCREEN_OPTIONS.find((o) => !used.has(o.key));
  return next?.key ?? null;
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

function createPrayer(category: PrayerCategory): PrayerSetting {
  return {
    category,
    prayerType: category === "weekday" ? "שחרית" : "שחרית שבת",
    daysOfWeek: category === "weekday" ? [0, 1, 2, 3, 4, 5] : [],
    mode: "fixed",
    fixedTime: "08:30",
    zmanAnchor: "sunset",
    offsetMinutes: 0,
    roundMode: "none"
  };
}

function createDefaultMinyan(): MinyanModel {
  return {
    name: "",
    displayStyle: "classic",
    prayerSettings: [createPrayer("weekday"), createPrayer("shabbat")],
    screens: [
      { screenKey: "main", sortOrder: 1, durationSeconds: 20, enabled: true },
      { screenKey: "clock", sortOrder: 2, durationSeconds: 12, enabled: true },
      { screenKey: "halacha", sortOrder: 3, durationSeconds: 18, enabled: true },
      { screenKey: "dailyLearning", sortOrder: 4, durationSeconds: 22, enabled: false }
    ]
  };
}

export default function GabbaiSynagoguePage({ params }: { params: Promise<{ synagogueId: string }> }) {
  const [synagogueId, setSynagogueId] = useState("");
  const [synagogueName, setSynagogueName] = useState("");
  const [minyanim, setMinyanim] = useState<MinyanModel[]>([]);
  const [halachaSettings, setHalachaSettings] = useState<HalachaSettingsModel>({
    startDate: new Date().toISOString().slice(0, 10),
    sourceKey: "kitzur_shulchan_arukh",
    displayMode: "summary"
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteMinyanIndex, setPendingDeleteMinyanIndex] = useState<number | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<1 | 2>(1);
  const [collapsedPrayerSections, setCollapsedPrayerSections] = useState<
    Record<number, { weekday: boolean; shabbat: boolean; screens: boolean }>
  >({});

  useEffect(() => {
    void params.then((p) => setSynagogueId(p.synagogueId));
  }, [params]);

  async function loadData(id: string) {
    const response = await fetch(`/api/admin/gabbai/${id}`, { cache: "no-store" });
    const payload = (await response.json()) as {
      ok: boolean;
      data?: { synagogue: { id: string; name: string }; minyanim: MinyanModel[]; halachaSettings: HalachaSettingsModel };
      error?: string;
    };
    if (!payload.ok || !payload.data) {
      setError(payload.error ?? "טעינת הנתונים נכשלה");
      return;
    }
    setSynagogueName(payload.data.synagogue.name);
    setMinyanim(payload.data.minyanim.length ? payload.data.minyanim : [createDefaultMinyan()]);
    setHalachaSettings(payload.data.halachaSettings);
  }

  useEffect(() => {
    if (!synagogueId) return;
    void loadData(synagogueId);
  }, [synagogueId]);

  const title = useMemo(() => `ממשק גבאי - ${synagogueName || synagogueId}`, [synagogueId, synagogueName]);
  const isPrayerSectionCollapsed = (minyanIndex: number, section: "weekday" | "shabbat" | "screens") =>
    collapsedPrayerSections[minyanIndex]?.[section] ?? true;
  const togglePrayerSection = (minyanIndex: number, section: "weekday" | "shabbat" | "screens") =>
    setCollapsedPrayerSections((prev) => ({
      ...prev,
      [minyanIndex]: {
        weekday: prev[minyanIndex]?.weekday ?? true,
        shabbat: prev[minyanIndex]?.shabbat ?? true,
        screens: prev[minyanIndex]?.screens ?? true,
        [section]: !isPrayerSectionCollapsed(minyanIndex, section)
      }
    }));

  const closeDeleteDialog = () => {
    setPendingDeleteMinyanIndex(null);
    setDeleteConfirmStep(1);
  };

  const openDeleteDialog = (minyanIndex: number) => {
    setPendingDeleteMinyanIndex(minyanIndex);
    setDeleteConfirmStep(1);
  };

  const confirmDeleteStepOne = () => {
    setDeleteConfirmStep(2);
  };

  const confirmDeleteStepTwo = () => {
    if (pendingDeleteMinyanIndex == null) return;
    setMinyanim((prev) => prev.filter((_, i) => i !== pendingDeleteMinyanIndex));
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
        body: JSON.stringify({ synagogueName, minyanim, halachaSettings })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setError(payload.error ?? "שמירה נכשלה");
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
    <main className="container py-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted-foreground">ניהול שם בית כנסת, מניינים, זמני תפילות, מסכים וסגנון תצוגה.</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>פרטי בית הכנסת</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block text-sm font-medium">שם בית הכנסת</label>
          <input className="h-10 w-full rounded-md border border-border bg-background px-3" value={synagogueName} onChange={(e) => setSynagogueName(e.target.value)} />
          <p className="text-sm text-muted-foreground">השם ישמש בכותרת המערכת (לפי בית הכנסת הפעיל).</p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>הגדרות הלכה יומית</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
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
                  sourceKey: e.target.value as "kitzur_shulchan_arukh"
                }))
              }
            >
              <option value="kitzur_shulchan_arukh">קיצור שולחן ערוך</option>
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

      <section className="mt-6 space-y-4">
        {minyanim.map((minyan, minyanIndex) => (
          <Card key={minyan.id ?? `new-${minyanIndex}`}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>מניין {minyanIndex + 1}</CardTitle>
                {minyan.id ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={`/display?synagogueId=${synagogueId}&minyanId=${minyan.id}`}>פתח תצוגה למניין זה</a>
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">שם המניין</label>
                  <input className="h-10 w-full rounded-md border border-border bg-background px-3" value={minyan.name} onChange={(e) => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, name: e.target.value } : m)))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">סגנון תצוגה</label>
                  <select className="h-10 w-full rounded-md border border-border bg-background px-3" value={minyan.displayStyle} onChange={(e) => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, displayStyle: e.target.value as DisplayStyle } : m)))}>
                    <option value="classic">Classic</option>
                    <option value="modern">Modern</option>
                    <option value="minimal">Minimal</option>
                    <option value="woodSilver">Wood & Silver</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-border/60 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">תפילות ימי חול</h3>
                  <div className="flex w-72 items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => togglePrayerSection(minyanIndex, "weekday")}>
                      {isPrayerSectionCollapsed(minyanIndex, "weekday") ? "פתח רשימה" : "סגור רשימה"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, prayerSettings: [...m.prayerSettings, createPrayer("weekday")] } : m)))}>
                      הוספת תפילה
                    </Button>
                  </div>
                </div>
                {!isPrayerSectionCollapsed(minyanIndex, "weekday")
                  ? minyan.prayerSettings.map((setting, prayerIndex) =>
                      setting.category === "weekday" ? (
                        <PrayerEditor key={`w-${prayerIndex}`} setting={setting} prayerOptions={WEEKDAY_PRAYERS} onChange={(next) => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, prayerSettings: m.prayerSettings.map((p, j) => (j === prayerIndex ? next : p)) } : m)))} onDelete={() => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, prayerSettings: m.prayerSettings.filter((_, j) => j !== prayerIndex) } : m)))} showDaysOfWeek />
                      ) : null
                    )
                  : null}
              </div>

              <div className="border-t border-border/60 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">תפילות שבת</h3>
                  <div className="flex w-72 items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => togglePrayerSection(minyanIndex, "shabbat")}>
                      {isPrayerSectionCollapsed(minyanIndex, "shabbat") ? "פתח רשימה" : "סגור רשימה"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, prayerSettings: [...m.prayerSettings, createPrayer("shabbat")] } : m)))}>
                      הוספת תפילת שבת
                    </Button>
                  </div>
                </div>
                {!isPrayerSectionCollapsed(minyanIndex, "shabbat")
                  ? minyan.prayerSettings.map((setting, prayerIndex) =>
                      setting.category === "shabbat" ? (
                        <PrayerEditor key={`s-${prayerIndex}`} setting={setting} prayerOptions={SHABBAT_PRAYERS} onChange={(next) => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, prayerSettings: m.prayerSettings.map((p, j) => (j === prayerIndex ? next : p)) } : m)))} onDelete={() => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, prayerSettings: m.prayerSettings.filter((_, j) => j !== prayerIndex) } : m)))} />
                      ) : null
                    )
                  : null}
              </div>

              <div className="border-t border-border/60 pt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">מסכים לתצוגה בלוח המודעות</h3>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!nextAvailableScreenKey(minyan.screens)}
                      onClick={() => {
                        const key = nextAvailableScreenKey(minyan.screens);
                        if (!key) return;
                        const maxOrder = minyan.screens.reduce((acc, s) => Math.max(acc, s.sortOrder), 0);
                        setMinyanim((prev) =>
                          prev.map((m, i) =>
                            i === minyanIndex
                              ? {
                                  ...m,
                                  screens: [
                                    ...m.screens,
                                    { screenKey: key, sortOrder: maxOrder + 1, durationSeconds: 20, enabled: true }
                                  ]
                                }
                              : m
                          )
                        );
                      }}
                    >
                      הוסף מסך
                    </Button>
                    <Button type="button" variant="outline" onClick={() => togglePrayerSection(minyanIndex, "screens")}>
                      {isPrayerSectionCollapsed(minyanIndex, "screens") ? "פתח רשימה" : "סגור רשימה"}
                    </Button>
                  </div>
                </div>
                {!isPrayerSectionCollapsed(minyanIndex, "screens") ? (
                  <div className="space-y-2">
                    {minyan.screens.map((screen, screenIndex) => (
                      <div
                        key={`${screen.screenKey}-${screenIndex}`}
                        className="grid grid-cols-1 items-center gap-2 rounded-md border border-border p-3 md:grid-cols-[minmax(0,1.35fr)_auto_minmax(0,1fr)_minmax(0,1fr)_auto]"
                      >
                        <select
                          className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm font-medium"
                          aria-label="סוג מסך"
                          value={screen.screenKey}
                          onChange={(e) => {
                            const next = e.target.value as ScreenKey;
                            setMinyanim((prev) =>
                              prev.map((m, i) =>
                                i === minyanIndex
                                  ? {
                                      ...m,
                                      screens: m.screens.map((s, j) => (j === screenIndex ? { ...s, screenKey: next } : s))
                                    }
                                  : m
                              )
                            );
                          }}
                        >
                          {SCREEN_OPTIONS.map((opt) => {
                            const takenByOther = minyan.screens.some(
                              (s, idx) => idx !== screenIndex && s.screenKey === opt.key
                            );
                            return (
                              <option key={opt.key} value={opt.key} disabled={takenByOther}>
                                {opt.label}
                              </option>
                            );
                          })}
                        </select>
                        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                          <input type="checkbox" checked={screen.enabled} onChange={(e) => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, screens: m.screens.map((s, j) => (j === screenIndex ? { ...s, enabled: e.target.checked } : s)) } : m)))} />
                          פעיל
                        </label>
                        <input type="number" className="h-10 w-full rounded-md border border-border bg-background px-3" value={screen.sortOrder} onChange={(e) => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, screens: m.screens.map((s, j) => (j === screenIndex ? { ...s, sortOrder: Number(e.target.value) } : s)) } : m)))} />
                        <input type="number" className="h-10 w-full rounded-md border border-border bg-background px-3" value={screen.durationSeconds} onChange={(e) => setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? { ...m, screens: m.screens.map((s, j) => (j === screenIndex ? { ...s, durationSeconds: Number(e.target.value) } : s)) } : m)))} />
                        <span className="text-sm text-muted-foreground md:text-end">שניות תצוגה</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <Button type="button" variant="outline" onClick={() => openDeleteDialog(minyanIndex)}>
                מחק מניין
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => setMinyanim((prev) => [...prev, createDefaultMinyan()])}>
          הוסף מניין
        </Button>
        <Button type="button" onClick={saveSettings} disabled={isSaving}>
          {isSaving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              שומר...
            </span>
          ) : (
            "שמור הגדרות גבאי"
          )}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={`/display?synagogueId=${synagogueId}`}>פתח מסך תצוגה</a>
        </Button>
        {message ? <span className="text-sm text-green-600">{message}</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>

      {pendingDeleteMinyanIndex != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-bold">
              {deleteConfirmStep === 1 ? "האם אתה בטוח? פעולה זו אינה הפיכה" : "המניין יימחק לצמיתות"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {deleteConfirmStep === 1
                ? "המערכת תעבור לשלב אישור נוסף לפני המחיקה בפועל."
                : "רק לחיצה על אישור תמחק את המניין מהמסך הנוכחי."}
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
  showDaysOfWeek = false
}: {
  setting: PrayerSetting;
  prayerOptions: PrayerType[];
  onChange: (next: PrayerSetting) => void;
  onDelete: () => void;
  showDaysOfWeek?: boolean;
}) {
  const currentOffset = setting.offsetMinutes ?? 0;
  const direction: "before" | "after" = currentOffset < 0 ? "before" : "after";
  const absoluteMinutes = Math.abs(currentOffset);

  return (
    <div className="mb-3 rounded-md border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">הגדרת תפילה</span>
        <Button type="button" variant="outline" onClick={onDelete}>
          מחק תפילה
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-6">
        <select className="h-10 rounded-md border border-border bg-background px-3" value={setting.prayerType} onChange={(e) => onChange({ ...setting, prayerType: e.target.value as PrayerType })}>
          {prayerOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select className="h-10 rounded-md border border-border bg-background px-3" value={setting.mode} onChange={(e) => onChange({ ...setting, mode: e.target.value as PrayerMode })}>
          <option value="fixed">זמן קבוע</option>
          <option value="relative">יחסית לזמן יום</option>
        </select>
        {setting.mode === "fixed" ? (
          <input type="time" className="h-10 rounded-md border border-border bg-background px-3" value={setting.fixedTime ?? ""} onChange={(e) => onChange({ ...setting, fixedTime: e.target.value })} />
        ) : (
          <>
            <select className="h-10 rounded-md border border-border bg-background px-3" value={setting.zmanAnchor ?? "sunset"} onChange={(e) => onChange({ ...setting, zmanAnchor: e.target.value })}>
              {ZMAN_ANCHORS.map((anchor) => (
                <option key={anchor.value} value={anchor.value}>
                  {anchor.label}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-border bg-background px-3"
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
              className="h-10 rounded-md border border-border bg-background px-3"
              value={absoluteMinutes}
              onChange={(e) =>
                onChange({
                  ...setting,
                  offsetMinutes: direction === "before" ? -Number(e.target.value) : Number(e.target.value)
                })
              }
              placeholder="מספר דקות"
            />
            <select
              className="h-10 rounded-md border border-border bg-background px-3"
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
        )}
      </div>
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
                    daysOfWeek: e.target.checked ? [...setting.daysOfWeek, day.value] : setting.daysOfWeek.filter((d) => d !== day.value)
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

