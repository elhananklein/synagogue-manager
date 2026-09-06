import { notFound } from "next/navigation";
import { CongregantForm } from "@/components/admin/congregant-form";
import { getCongregant, listCongregants, listSynagogueMinyanOptions } from "@/lib/congregant-db";
import { mapCongregantApiError } from "@/lib/congregant-errors";

export default async function EditCongregantPage({
  params
}: {
  params: Promise<{ synagogueId: string; congregantId: string }>;
}) {
  const { synagogueId, congregantId } = await params;
  const [found, minyanim, listed] = await Promise.all([
    getCongregant(synagogueId, congregantId),
    listSynagogueMinyanOptions(synagogueId),
    listCongregants(synagogueId)
  ]);

  if (!found.row) {
    if (found.error && found.error !== "not_found") {
      return <p className="gabbai-err">{mapCongregantApiError(found.error)}</p>;
    }
    notFound();
  }

  return (
    <>
      <h1 className="gabbai-page-title">עריכת מתפלל</h1>
      <CongregantForm
        synagogueId={synagogueId}
        minyanim={minyanim}
        initial={found.row}
        congregantId={congregantId}
        familyPeople={(listed.rows ?? []).filter((row) => row.id !== congregantId)}
      />
    </>
  );
}
