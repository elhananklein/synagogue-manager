import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type HalachaPayload = {
  halachaDate: string;
  title: string;
  content: string;
  published: boolean;
};

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "missing_supabase_env" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("daily_halacha")
    .select("halacha_date, title, content, published")
    .order("halacha_date", { ascending: false })
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
  const halachaDate = (body.halachaDate ?? "").trim();
  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  const published = Boolean(body.published);

  if (!isValidIsoDate(halachaDate)) {
    return NextResponse.json({ ok: false, error: "invalid_halacha_date" }, { status: 400 });
  }

  if (!title || !content) {
    return NextResponse.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
  }

  const { error } = await supabase.from("daily_halacha").upsert(
    {
      halacha_date: halachaDate,
      title,
      content,
      published
    },
    {
      onConflict: "halacha_date"
    }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

