import { GabbaiGuide } from "@/components/admin/gabbai-guide";

export default async function GabbaiGuidePage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId } = await params;
  return <GabbaiGuide synagogueId={synagogueId} />;
}
