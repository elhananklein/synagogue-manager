import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type HalachaPayload = {
  displayDay: number;
  title: string;
  content: string;
  published: boolean;
  fullText?: string;
  summaryText?: string;
  sourceKey?: string;
  source?: string;
  bookName?: string;
  chapterNumber?: number;
  sectionNumber?: number;
  topic?: string;
};

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

const ADMIN_HALACHA_SOURCE_KEY = "manual";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_supabase_env" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("daily_halacha")
    .select("display_day, title, content, full_text, summary_text, source_key, source, book_name, chapter_number, section_number, topic, published")
    .eq("source_key", ADMIN_HALACHA_SOURCE_KEY)
    .order("display_day", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data ?? null });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_supabase_env" }, { status: 500 });
  }

  const body = (await request.json()) as Partial<HalachaPayload>;

  const displayDay =
    typeof body.displayDay === "number" && Number.isFinite(body.displayDay) ? Math.floor(body.displayDay) : NaN;
  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  const published = Boolean(body.published);
  const fullText = (body.fullText ?? content).trim();
  const summaryText = (body.summaryText ?? content).trim();
  const source = (body.source ?? "").trim() || null;
  const sourceKey = ADMIN_HALACHA_SOURCE_KEY;
  const bookName = (body.bookName ?? "").trim() || null;
  const chapterNumber = typeof body.chapterNumber === "number" && Number.isFinite(body.chapterNumber) ? body.chapterNumber : null;
  const sectionNumber = typeof body.sectionNumber === "number" && Number.isFinite(body.sectionNumber) ? body.sectionNumber : null;
  const topic = (body.topic ?? "").trim() || null;

  if (!Number.isInteger(displayDay) || displayDay < 1) {
    return NextResponse.json({ ok: false, error: "invalid_display_day" }, { status: 400 });
  }

  if (!title || !content) {
    return NextResponse.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
  }

  const { error } = await supabase.from("daily_halacha").upsert(
    {
      display_day: displayDay,
      title,
      content,
      full_text: fullText,
      summary_text: summaryText,
      source,
      source_key: sourceKey,
      book_name: bookName,
      chapter_number: chapterNumber,
      section_number: sectionNumber,
      topic,
      published
    },
    {
      onConflict: "source_key,display_day"
    }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
