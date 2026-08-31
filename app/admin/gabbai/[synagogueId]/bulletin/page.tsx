"use client";

import { use } from "react";
import { useState } from "react";
import { BulletinBoardEditor, mapBulletinForSave } from "@/components/admin/bulletin-board-editor";
import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";
import { GabbaiSaveBar } from "@/components/admin/gabbai-save-bar";
import { mapGabbaiSaveError, saveGabbaiSection, useGabbaiWorkspace } from "@/lib/gabbai-workspace";

export default function GabbaiBulletinPage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = use(params);
  const { bulletinItems, setBulletinItems, isLoading, error: loadError, reload } = useGabbaiWorkspace(synagogueId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload = await saveGabbaiSection(synagogueId, {
      section: "bulletin",
      bulletinItems: mapBulletinForSave(bulletinItems)
    });
    setSaving(false);
    if (!payload.ok) {
      setError(mapGabbaiSaveError(payload.error));
      return;
    }
    setMessage("המודעות נשמרו");
    await reload();
  }

  if (isLoading) return <GabbaiLoadingPanel title="טוען את לוח המודעות…" />;
  if (loadError) return <p className="gabbai-err">{loadError}</p>;

  return (
    <>
      <h1 className="gabbai-page-title">לוח מודעות</h1>
      <p className="gabbai-page-desc">
        כאן מפרסמים הודעה שתופיע על המסך. אחרי הכתיבה — לחצו על שמירה. כדי שזה יוצג על הקיר, ודאו שמסך «לוח מודעות» פעיל במראה המסך.
      </p>
      <BulletinBoardEditor
        synagogueId={synagogueId}
        items={bulletinItems}
        hideChrome
        onChange={(items) => {
          setBulletinItems(items);
          setMessage(null);
        }}
      />
      <GabbaiSaveBar label="שמירת המודעות" saving={saving} message={message} error={error} onSave={() => void save()} />
    </>
  );
}
