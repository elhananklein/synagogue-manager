import { CongregantForm } from "@/components/admin/congregant-form";
import { listCongregants, listSynagogueMinyanOptions } from "@/lib/congregant-db";
import { emptyCongregantInput } from "@/lib/congregant-types";

export default async function NewCongregantPage({
  params,
  searchParams
}: {
  params: Promise<{ synagogueId: string }>;
  searchParams: Promise<{ minyanId?: string }>;
}) {
  const { synagogueId } = await params;
  const query = await searchParams;
  const [minyanim, listed] = await Promise.all([
    listSynagogueMinyanOptions(synagogueId),
    listCongregants(synagogueId)
  ]);
  const requested = query.minyanId?.trim() ?? "";
  const minyanId = minyanim.some((item) => item.id === requested) ? requested : minyanim[0]?.id ?? null;

  return (
    <>
      <h1 className="gabbai-page-title">מתפלל חדש</h1>
      <CongregantForm
        synagogueId={synagogueId}
        minyanim={minyanim}
        initial={emptyCongregantInput(minyanId)}
        familyPeople={listed.rows ?? []}
      />
    </>
  );
}
