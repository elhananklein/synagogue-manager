"use client";

import { use } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";
import { GabbaiSaveBar } from "@/components/admin/gabbai-save-bar";
import { isLiveHalachaSource } from "@/lib/halacha-source";
import {
  mapGabbaiSaveError,
  saveGabbaiSection,
  useGabbaiWorkspace,
  type HalachaSettingsModel
} from "@/lib/gabbai-workspace";

export default function GabbaiSettingsPage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = use(params);
  const {
    synagogueName,
    setSynagogueName,
    minyanim,
    setMinyanim,
    halachaSettings,
    setHalachaSettings,
    isLoading,
    error: loadError,
    reload
  } = useGabbaiWorkspace(synagogueId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload = await saveGabbaiSection(synagogueId, {
      section: "settings",
      synagogueName,
      halachaSettings,
      minyanNames: minyanim
        .filter((m) => m.id)
        .map((m) => ({ id: m.id as string, name: m.name }))
    });
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    setMessage("ההגדרות נשמרו");
    await reload();
  }

  async function addMinyan() {
    setSaving(true);
    setError(null);
    const payload = await saveGabbaiSection(synagogueId, {
      section: "minyan-create",
      minyanName: "מניין חדש"
    });
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    await reload();
    setMessage("נוסף מניין חדש — אפשר לשנות את שמו ולשמור");
  }

  async function deleteMinyan(id: string) {
    setSaving(true);
    setError(null);
    const payload = await saveGabbaiSection(synagogueId, {
      section: "minyan-delete",
      minyanId: id
    });
    setPendingDeleteId(null);
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    setMessage("המניין נמחק");
    await reload();
  }

  if (isLoading) return <GabbaiLoadingPanel title="טוען הגדרות…" />;
  if (loadError) return <p className="gabbai-err">{loadError}</p>;

  const liveHalacha = isLiveHalachaSource(halachaSettings.sourceKey);

  return (
    <>
      <h1 className="gabbai-page-title">הגדרות בית הכנסת</h1>
      <p className="gabbai-page-desc">שם בית הכנסת, המניינים, ומאיפה מגיעה ההלכה היומית.</p>

      <label className="mb-6 block">
        <span className="mb-1 block text-sm font-medium">שם בית הכנסת</span>
        <input
          className="h-11 w-full rounded-md border border-border bg-background px-3"
          value={synagogueName}
          onChange={(e) => {
            setSynagogueName(e.target.value);
            setMessage(null);
          }}
        />
      </label>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold">מניינים</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => void addMinyan()} disabled={saving}>
            הוספת מניין
          </Button>
        </div>
        <div className="space-y-2">
          {minyanim.map((m, i) => (
            <div key={m.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3">
              <input
                className="h-11 min-w-[8rem] flex-1 rounded-md border border-border bg-background px-3"
                value={m.name}
                placeholder={`מניין ${i + 1}`}
                onChange={(e) => {
                  setMinyanim((prev) => prev.map((row, j) => (j === i ? { ...row, name: e.target.value } : row)));
                  setMessage(null);
                }}
              />
              {m.id && minyanim.length > 1 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setPendingDeleteId(m.id ?? null)}>
                  מחיקה
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-base font-extrabold">הלכה יומית</h2>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium">מאיפה מגיעה ההלכה?</span>
          <select
            className="h-11 w-full rounded-md border border-border bg-background px-3"
            value={
              halachaSettings.sourceKey === "yalkut_yosef" ? "sefaria_halacha_yomit" : halachaSettings.sourceKey
            }
            onChange={(e) =>
              setHalachaSettings((prev) => ({
                ...prev,
                sourceKey: e.target.value as HalachaSettingsModel["sourceKey"]
              }))
            }
          >
            <option value="sefaria_halacha_yomit">הלכה יומית משולחן ערוך</option>
            <option value="kitzur_shulchan_arukh">קיצור שולחן ערוך</option>
            <option value="manual">הלכות שהוזנו ידנית</option>
          </select>
        </label>
        {liveHalacha ? (
          <p className="text-sm text-muted-foreground">כל יום תוצג הלכת היום. אם אין רשת — תוצג הלכת אתמול, לא מסך ריק.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium">תאריך התחלה</span>
              <input
                type="date"
                className="h-11 w-full rounded-md border border-border bg-background px-3"
                value={halachaSettings.startDate}
                onChange={(e) => setHalachaSettings((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">אופן תצוגה</span>
              <select
                className="h-11 w-full rounded-md border border-border bg-background px-3"
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
            </label>
          </div>
        )}
      </section>

      <GabbaiSaveBar label="שמירת ההגדרות" saving={saving} message={message} error={error} onSave={() => void save()} />

      {pendingDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-bold">למחוק את המניין?</h3>
            <p className="mt-2 text-sm text-muted-foreground">המניין וזמני התפילה שלו יימחקו. לא ניתן לבטל.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingDeleteId(null)}>
                ביטול
              </Button>
              <Button type="button" onClick={() => void deleteMinyan(pendingDeleteId)}>
                כן, למחוק
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
