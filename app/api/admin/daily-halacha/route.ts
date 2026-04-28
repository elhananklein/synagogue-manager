import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { fetchKitzurHalacha } from "@/lib/data/kitzur-shulchan-arukh";

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
  generateBatch?: boolean;
  batchSize?: number;
};

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

async function getNextDisplayDay(supabase: ReturnType<typeof createClient>, sourceKey: string) {
  const { data } = await supabase
    .from("daily_halacha")
    .select("display_day")
    .eq("source_key", sourceKey)
    .order("display_day", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.display_day ?? 0) + 1;
}

async function getLastKitzurCursor(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("daily_halacha")
    .select("chapter_number, section_number")
    .eq("book_name", "קיצור שולחן ערוך")
    .not("chapter_number", "is", null)
    .not("section_number", "is", null)
    .order("display_day", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    chapterNumber: data?.chapter_number ?? 1,
    sectionNumber: data?.section_number ?? 0
  };
}

async function findNextHalacha(chapterNumber: number, sectionNumber: number) {
  let chapter = chapterNumber;
  let section = sectionNumber + 1;
  while (chapter <= 400) {
    const item = await fetchKitzurHalacha(chapter, section);
    if (item) return item;
    chapter += 1;
    section = 1;
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_supabase_env" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("daily_halacha")
    .select("display_day, title, content, full_text, summary_text, source_key, source, book_name, chapter_number, section_number, topic, published")
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
  const activeSourceKey = (body.sourceKey ?? "kitzur_shulchan_arukh").trim() || "kitzur_shulchan_arukh";
  if (body.generateBatch) {
    const batchSize = Math.min(10, Math.max(1, Number(body.batchSize ?? 10)));
    const startDisplayDay = await getNextDisplayDay(supabase, activeSourceKey);
    const lastCursor = await getLastKitzurCursor(supabase);
    const rows: Array<Record<string, unknown>> = [];
    let cursor = { ...lastCursor };

    for (let index = 0; index < batchSize; index += 1) {
      const nextHalacha = await findNextHalacha(cursor.chapterNumber, cursor.sectionNumber);
      if (!nextHalacha) break;
      const targetDisplayDay = startDisplayDay + index;
      rows.push({
        display_day: targetDisplayDay,
        title: `${nextHalacha.bookName} ${nextHalacha.chapterNumber}:${nextHalacha.sectionNumber}`,
        content: nextHalacha.summaryText,
        full_text: nextHalacha.fullText,
        summary_text: nextHalacha.summaryText,
        source: "Sefaria",
        source_key: activeSourceKey,
        book_name: nextHalacha.bookName,
        chapter_number: nextHalacha.chapterNumber,
        section_number: nextHalacha.sectionNumber,
        topic: nextHalacha.topic,
        published: true
      });
      cursor = {
        chapterNumber: nextHalacha.chapterNumber,
        sectionNumber: nextHalacha.sectionNumber
      };
    }

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "kitzur_source_exhausted" }, { status: 400 });
    }

    const { error } = await supabase.from("daily_halacha").upsert(rows, {
      onConflict: "source_key,display_day"
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      inserted: rows.length,
      startDisplayDay,
      endDisplayDay: (rows[rows.length - 1]?.display_day as number | undefined) ?? startDisplayDay
    });
  }

  const displayDay =
    typeof body.displayDay === "number" && Number.isFinite(body.displayDay) ? Math.floor(body.displayDay) : NaN;
  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  const published = Boolean(body.published);
  const fullText = (body.fullText ?? content).trim();
  const summaryText = (body.summaryText ?? content).trim();
  const source = (body.source ?? "").trim() || null;
  const sourceKey = (body.sourceKey ?? "manual").trim() || "manual";
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

