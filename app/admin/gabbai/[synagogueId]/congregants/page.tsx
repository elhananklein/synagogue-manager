import { CongregantsManager } from "@/components/admin/congregants-manager";
import { listCongregants, listSynagogueMinyanOptions } from "@/lib/congregant-db";
import { mapCongregantApiError } from "@/lib/congregant-errors";

export default async function CongregantsPage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = await params;
  const [list, minyanim] = await Promise.all([
    listCongregants(synagogueId),
    listSynagogueMinyanOptions(synagogueId)
  ]);

  if (list.error) {
    return <p className="gabbai-err">{mapCongregantApiError(list.error)}</p>;
  }

  return (
    <>
      <h1 className="gabbai-page-title">מתפללים</h1>
      <p className="gabbai-page-desc">
        כאן נרשמים המתפללים לפי מניין. אפשר להוסיף אחד־אחד, לייבא אקסל, או לשלוח קישור למילוי עצמי.
      </p>
      <CongregantsManager synagogueId={synagogueId} initialCongregants={list.rows} minyanim={minyanim} />
    </>
  );
}
