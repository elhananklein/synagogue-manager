import { notFound } from "next/navigation";
import { PushMessagesPanel } from "@/components/admin/push-messages-panel";
import { isPushNotificationsEnabled } from "@/lib/push-feature";
import { parseSynagogueId } from "@/lib/synagogue-id";

export const dynamic = "force-dynamic";

export default async function GabbaiPushPage({
  params
}: {
  params: Promise<{ synagogueId: string }>;
}) {
  const { synagogueId: rawId } = await params;
  const synagogueId = parseSynagogueId(rawId);
  if (!synagogueId || !isPushNotificationsEnabled(synagogueId)) notFound();

  return (
    <>
      <h1 className="gabbai-lead">התראות לקהל</h1>
      <p className="gabbai-hint">
        שליחת הודעה לכל מי שהתקין את אפליקציית בית הכנסת ואישר התראות. כרגע פעיל רק בבית הכנסת לבדיקות.
      </p>
      <PushMessagesPanel synagogueId={synagogueId} />
    </>
  );
}
