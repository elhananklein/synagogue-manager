import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
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

export default async function MobileJoinPage({
  searchParams
}: {
  searchParams: Promise<{ synagogueId?: string; minyanId?: string }>;
}) {
  const query = await searchParams;
  const synagogueId = parseSynagogueId(query.synagogueId);
  if (!synagogueId) {
    return (
      <div className="m-shell">
        <header className="m-header m-header--simple">
          <Link href="/m" aria-label="חזרה" className="text-[#fff8ea]">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <span className="text-base font-extrabold">הרשמה</span>
        </header>
        <main className="m-main">
          <p className="m-lead">חסר בית כנסת בקישור. בקשו מהגבאי קישור הרשמה מעודכן.</p>
        </main>
      </div>
    );
  }
  const ctx = await getPublicJoinContext(synagogueId);
  if ("error" in ctx) notFound();
  const title = synagogueAppName(ctx.synagogue.name);

  return (
    <div className="m-shell">
      <header className="m-header m-header--simple">
        <Link
          href={`/m/display?synagogueId=${encodeURIComponent(synagogueId)}`}
          aria-label="חזרה"
          className="text-[#fff8ea]"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <span className="min-w-0 truncate text-base font-extrabold">{title}</span>
      </header>
      <main className="m-main">
        <CongregantSelfJoinForm
          synagogueId={synagogueId}
          synagogueName={title}
          minyanim={ctx.minyanim}
          initialMinyanId={query.minyanId ?? null}
          embedded
        />
      </main>
    </div>
  );
}
