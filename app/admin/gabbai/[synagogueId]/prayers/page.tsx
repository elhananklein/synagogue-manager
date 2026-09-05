"use client";

import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";
import { GabbaiMinyanSwitch } from "@/components/admin/gabbai-minyan-switch";
import { GabbaiSaveBar } from "@/components/admin/gabbai-save-bar";
import { PrayerEditor } from "@/components/admin/prayer-editor";
import { ParashaPrayerCatalogEditor } from "@/components/admin/parasha-prayer-catalog-editor";
import {
  createPrayer,
  insertPrayerAtCategoryStart,
  mapGabbaiSaveError,
  prayersForSave,
  saveGabbaiSection,
  useGabbaiWorkspace
} from "@/lib/gabbai-workspace";
import type { PrayerType } from "@/lib/gabbai-types";

const WEEKDAY_PRAYERS: PrayerType[] = ["סליחות", "שחרית", "מנחה", "ערבית"];
const SHABBAT_PRAYERS: PrayerType[] = ["מנחה ערב שבת", "שחרית שבת", "מנחה שבת", "ערבית מוצ'ש"];

export default function GabbaiPrayersPage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = use(params);
  const { minyanim, setMinyanim, isLoading, error: loadError, reload } = useGabbaiWorkspace(synagogueId);
  const [minyanIndex, setMinyanIndex] = useState(0);
  const [parashaCatalogKeys, setParashaCatalogKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/hebcal/parasha-catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((p: { keys?: string[] }) => setParashaCatalogKeys(Array.isArray(p.keys) ? p.keys : []))
      .catch(() => setParashaCatalogKeys([]));
  }, []);

  const minyan = minyanim[minyanIndex] ?? minyanim[0];

  function updateMinyan(updater: (m: NonNullable<typeof minyan>) => NonNullable<typeof minyan>) {
    setMinyanim((prev) => prev.map((m, i) => (i === minyanIndex ? updater(m) : m)));
    setMessage(null);
  }

  async function save() {
    if (!minyan?.id) {
      setError("שמרו קודם את המניין בהגדרות בית הכנסת.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    if (minyan.prayerSettings.some((p) => !p.prayerType)) {
      setSaving(false);
      setError("יש לבחור תפילה בכל שורה חדשה");
      return;
    }
    const payload = await saveGabbaiSection(synagogueId, {
      section: "prayers",
      minyanId: minyan.id,
      prayerSettings: prayersForSave(minyan.prayerSettings)
    });
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    setMessage("זמני התפילה נשמרו");
    await reload();
  }

  if (isLoading) return <GabbaiLoadingPanel title="טוען את זמני התפילה…" />;
  if (loadError) return <p className="gabbai-err">{loadError}</p>;
  if (!minyan) return <p className="gabbai-hint">אין מניין. הוסיפו מניין בהגדרות בית הכנסת.</p>;

  return (
    <>
      <h1 className="gabbai-page-title">זמני תפילה</h1>
      <p className="gabbai-page-desc">
        כאן קובעים מתי מתפללים — כולל סליחות בימי חול. אחרי שינוי — לחצו על שמירה למטה. טבלת הפרשות (אם משתמשים בה) נשמרת בלחצן שלה, בנפרד.
      </p>
      <GabbaiMinyanSwitch
        names={minyanim.map((m) => m.name)}
        index={Math.min(minyanIndex, minyanim.length - 1)}
        onChange={setMinyanIndex}
      />

      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold">ימי חול</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateMinyan((m) => ({
                ...m,
                prayerSettings: insertPrayerAtCategoryStart(m.prayerSettings, createPrayer("weekday"))
              }))
            }
          >
            הוספת תפילה
          </Button>
        </div>
        {minyan.prayerSettings.map((setting, prayerIndex) =>
          setting.category === "weekday" ? (
            <PrayerEditor
              key={setting.clientId}
              setting={setting}
              prayerOptions={WEEKDAY_PRAYERS}
              parashaCatalogKeys={parashaCatalogKeys}
              showDaysOfWeek
              onChange={(next) =>
                updateMinyan((m) => ({
                  ...m,
                  prayerSettings: m.prayerSettings.map((p, j) => (j === prayerIndex ? next : p))
                }))
              }
              onDelete={() =>
                updateMinyan((m) => ({
                  ...m,
                  prayerSettings: m.prayerSettings.filter((_, j) => j !== prayerIndex)
                }))
              }
            />
          ) : null
        )}
      </div>

      {minyan.id ? (
        <div className="mb-6">
          <ParashaPrayerCatalogEditor
            key={minyan.id}
            synagogueId={synagogueId}
            minyanId={minyan.id}
            parashaKeys={parashaCatalogKeys}
            savedRows={minyan.parashaCatalog}
          />
        </div>
      ) : null}

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold">שבת</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateMinyan((m) => ({
                ...m,
                prayerSettings: insertPrayerAtCategoryStart(m.prayerSettings, createPrayer("shabbat"))
              }))
            }
          >
            הוספת תפילת שבת
          </Button>
        </div>
        {minyan.prayerSettings.map((setting, prayerIndex) =>
          setting.category === "shabbat" ? (
            <PrayerEditor
              key={setting.clientId}
              setting={setting}
              prayerOptions={SHABBAT_PRAYERS}
              onChange={(next) =>
                updateMinyan((m) => ({
                  ...m,
                  prayerSettings: m.prayerSettings.map((p, j) => (j === prayerIndex ? next : p))
                }))
              }
              onDelete={() =>
                updateMinyan((m) => ({
                  ...m,
                  prayerSettings: m.prayerSettings.filter((_, j) => j !== prayerIndex)
                }))
              }
            />
          ) : null
        )}
      </div>

      <GabbaiSaveBar label="שמירת זמני התפילה" saving={saving} message={message} error={error} onSave={() => void save()} />
    </>
  );
}
