"use client";

import { use } from "react";
import { useState } from "react";
import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";
import { GabbaiMinyanSwitch } from "@/components/admin/gabbai-minyan-switch";
import { GabbaiSaveBar } from "@/components/admin/gabbai-save-bar";
import { ShabbatAgendaEditor, mapShabbatAgendaForSave } from "@/components/admin/shabbat-agenda-editor";
import { mapGabbaiSaveError, saveGabbaiSection, useGabbaiWorkspace } from "@/lib/gabbai-workspace";

export default function GabbaiShabbatPage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = use(params);
  const { minyanim, setMinyanim, shabbatParashaHint, isLoading, error: loadError, reload } =
    useGabbaiWorkspace(synagogueId);
  const [minyanIndex, setMinyanIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const minyan = minyanim[minyanIndex] ?? minyanim[0];

  async function save() {
    if (!minyan?.id) {
      setError("שמרו קודם את המניין בהגדרות בית הכנסת.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload = await saveGabbaiSection(synagogueId, {
      section: "shabbat",
      minyanId: minyan.id,
      shabbatAgendaItems: mapShabbatAgendaForSave(minyan.shabbatAgendaItems)
    });
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    setMessage("סדר השבת נשמר");
    await reload();
  }

  if (isLoading) return <GabbaiLoadingPanel title="טוען את סדר השבת…" />;
  if (loadError) return <p className="gabbai-err">{loadError}</p>;
  if (!minyan) return <p className="gabbai-hint">אין מניין. הוסיפו מניין בהגדרות בית הכנסת.</p>;

  return (
    <>
      <h1 className="gabbai-page-title">סדר שבת</h1>
      <p className="gabbai-page-desc">
        רשימת מה שקורה בשבת הקרובה, לפי הסדר. לדוגמה: כניסת שבת, קבלת שבת, קריאת התורה, קידוש.
      </p>
      <GabbaiMinyanSwitch
        names={minyanim.map((m) => m.name)}
        index={Math.min(minyanIndex, minyanim.length - 1)}
        onChange={setMinyanIndex}
      />
      <ShabbatAgendaEditor
        items={minyan.shabbatAgendaItems}
        parashaHint={shabbatParashaHint}
        onChange={(items) => {
          setMinyanim((prev) =>
            prev.map((m, i) => (i === minyanIndex ? { ...m, shabbatAgendaItems: items } : m))
          );
          setMessage(null);
        }}
      />
      <GabbaiSaveBar label="שמירת סדר השבת" saving={saving} message={message} error={error} onSave={() => void save()} />
    </>
  );
}
