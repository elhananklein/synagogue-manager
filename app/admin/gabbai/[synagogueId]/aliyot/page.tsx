import { AliyahSheetEditor } from "@/components/admin/aliyah-sheet";
import { loadAliyahWorkspace } from "@/lib/aliyah-db";
import { mapAliyahApiError } from "@/lib/aliyah-errors";
import { defaultAliyahServiceDate, jerusalemTodayIso } from "@/lib/aliyah-slots";

export default async function AliyotPage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = await params;
  const workspace = await loadAliyahWorkspace(synagogueId);
  if (workspace.error) {
    return <p className="gabbai-err">{mapAliyahApiError(workspace.error)}</p>;
  }

  return (
    <>
      <h1 className="gabbai-page-title">עליות</h1>
      <p className="gabbai-page-desc">
        סמנו מי עלה לתורה בשבת או בחג. אם העולה לא ברשימת המתפללים, מוסיפים אותו מכאן וממשיכים ישר לעלייה.
      </p>
      <AliyahSheetEditor
        synagogueId={synagogueId}
        initialMinyanim={workspace.minyanim}
        initialCongregants={workspace.congregants ?? []}
        initialDate={defaultAliyahServiceDate(jerusalemTodayIso())}
      />
    </>
  );
}
