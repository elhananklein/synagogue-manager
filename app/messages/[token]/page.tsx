import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CongregantThemeFrame } from "@/components/admin/congregant-theme-frame";
import { MessagesConsentPanel } from "@/components/congregant/messages-consent-panel";
import { getMessagesConsentByToken } from "@/lib/messages-consent-db";
import { synagogueAppName } from "@/lib/synagogue-public-title";
import "@/app/admin/gabbai/congregant-theme.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "הודעות מבית הכנסת",
  robots: { index: false, follow: false }
};

export default async function MessagesConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getMessagesConsentByToken(token);
  if (!view) notFound();
  const synagogueName = synagogueAppName(view.synagogueName);

  return (
    <main>
      <CongregantThemeFrame minyan={view.minyan}>
        <div className="congregant-join-page">
          <div className="congregant-card">
            <div className="congregant-card-head">
              <div>
                <h2>הודעות מ{synagogueName}</h2>
                <p>אישור או ביטול של הודעות בוואטסאפ וב-SMS</p>
              </div>
            </div>
            <div className="congregant-card-body">
              <MessagesConsentPanel
                token={token}
                firstName={view.firstName}
                gender={view.gender}
                initialConsent={view.consent}
              />
            </div>
          </div>
        </div>
      </CongregantThemeFrame>
    </main>
  );
}
