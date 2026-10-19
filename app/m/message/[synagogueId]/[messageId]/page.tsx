import Link from "next/link";
import { notFound } from "next/navigation";
import { getPushMessage } from "@/lib/push-db";
import { isPushNotificationsEnabled } from "@/lib/push-feature";
import { parseSynagogueId } from "@/lib/synagogue-id";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function formatSentAt(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem"
  }).format(date);
}

export default async function MobilePushMessagePage({
  params
}: {
  params: Promise<{ synagogueId: string; messageId: string }>;
}) {
  const { synagogueId: rawId, messageId } = await params;
  const synagogueId = parseSynagogueId(rawId);
  if (!synagogueId || !messageId?.trim() || !isPushNotificationsEnabled(synagogueId)) notFound();

  const message = await getPushMessage(synagogueId, messageId.trim());
  if (!message.row || message.row.status === "scheduled" || message.row.status === "cancelled") {
    notFound();
  }

  let synagogueName = "בית הכנסת";
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const res = await supabase.from("synagogues").select("name").eq("id", synagogueId).maybeSingle();
    if (!res.error && res.data?.name) synagogueName = String(res.data.name);
  }

  const sentLabel = formatSentAt(message.row.sentAt || message.row.createdAt);
  const homeHref = `/m/display?synagogueId=${encodeURIComponent(synagogueId)}`;

  return (
    <main className="m-message-page" dir="rtl">
      <article className="m-message-card">
        <p className="m-message-meta">{synagogueName}</p>
        <h1>{message.row.title}</h1>
        {sentLabel ? <p className="m-message-meta">נשלח {sentLabel}</p> : null}
        <p className="m-message-body">{message.row.body}</p>
        <div className="m-message-actions">
          <Link href={homeHref}>חזרה לאפליקציה</Link>
        </div>
      </article>
    </main>
  );
}
