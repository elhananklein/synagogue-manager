import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RedirectHandheldToMobile } from "@/components/mobile/redirect-handheld-to-mobile";
import { CongregantSelfJoinForm } from "@/components/congregant/self-join-form";
import { getPublicJoinContext } from "@/lib/congregant-db";
import { parseSynagogueId } from "@/lib/synagogue-id";
import { synagogueAppName } from "@/lib/synagogue-public-title";
import "@/app/admin/gabbai/congregant-theme.css";

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ synagogueId?: string }>;
}): Promise<Metadata> {
  const query = await searchParams;
  const synagogueId = parseSynagogueId(query.synagogueId);
  if (!synagogueId) return { title: "הרשמה לבית הכנסת" };
  const ctx = await getPublicJoinContext(synagogueId);
  if ("error" in ctx) return { title: "הרשמה לבית הכנסת" };
  return { title: `הרשמה — ${synagogueAppName(ctx.synagogue.name)}` };
}

export default async function JoinPage({
  searchParams
}: {
  searchParams: Promise<{ synagogueId?: string; minyanId?: string }>;
}) {
  const query = await searchParams;
  const synagogueId = parseSynagogueId(query.synagogueId);
  if (!synagogueId) {
    return (
      <main className="container py-10">
        <RedirectHandheldToMobile />
        <p className="mx-auto max-w-lg text-center text-lg font-semibold">
          חסר בית כנסת בקישור. בקשו מהגבאי קישור הרשמה מעודכן.
        </p>
      </main>
    );
  }
  const ctx = await getPublicJoinContext(synagogueId);
  if ("error" in ctx) notFound();

  return (
    <main>
      <RedirectHandheldToMobile />
      <CongregantSelfJoinForm
        synagogueId={synagogueId}
        synagogueName={synagogueAppName(ctx.synagogue.name)}
        minyanim={ctx.minyanim}
        initialMinyanId={query.minyanId ?? null}
      />
    </main>
  );
}
