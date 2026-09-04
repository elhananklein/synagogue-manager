import { NextResponse } from "next/server";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { insertCongregants, listCongregants, listSynagogueMinyanOptions } from "@/lib/congregant-db";
import { parseCongregantSpreadsheet, type CongregantImportIssue } from "@/lib/congregant-excel";
import { emptyCongregantInput, normalizePhone, validateCongregantInput, type CongregantInput } from "@/lib/congregant-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const contentType = request.headers.get("content-type") ?? "";
  const minyanim = await listSynagogueMinyanOptions(access.synagogueId);
  const minyanIds = new Set(minyanim.map((item) => item.id));

  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as { inputs?: Partial<CongregantInput>[] };
    const inputs = (payload.inputs ?? []).map((row) => ({ ...emptyCongregantInput(), ...row }));
    const existing = await listCongregants(access.synagogueId);
    if (existing.error) {
      return NextResponse.json({ ok: false, error: existing.error }, { status: 500 });
    }
    const phones = new Set(existing.rows.map((row) => normalizePhone(row.phone)).filter(Boolean));
    const emails = new Set(existing.rows.map((row) => row.email.trim().toLowerCase()).filter(Boolean));
    const accepted: CongregantInput[] = [];
    const issues: CongregantImportIssue[] = [];
    inputs.forEach((input, index) => {
      const validated = validateCongregantInput(input, minyanIds);
      if (validated.errors.length) {
        issues.push({ line: index + 2, message: validated.errors[0] });
        return;
      }
      const phone = normalizePhone(validated.next.phone);
      const email = validated.next.email.trim().toLowerCase();
      if (phone && phones.has(phone)) {
        issues.push({ line: index + 2, message: `הטלפון ${phone} כבר רשום` });
        return;
      }
      if (email && emails.has(email)) {
        issues.push({ line: index + 2, message: `המייל ${email} כבר רשום` });
        return;
      }
      if (phone) phones.add(phone);
      if (email) emails.add(email);
      accepted.push(validated.next);
    });
    if (!accepted.length) {
      return NextResponse.json({ ok: false, error: "no_valid_rows", issues }, { status: 400 });
    }
    const saved = await insertCongregants(access.synagogueId, accepted);
    if (saved.error) {
      return NextResponse.json({ ok: false, error: saved.error, issues }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      inserted: saved.rows.length,
      skipped: issues.length,
      issues
    });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
    return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
  }
  const parsed = parseCongregantSpreadsheet(Buffer.from(await file.arrayBuffer()), minyanim);
  const existing = await listCongregants(access.synagogueId);
  if (existing.error) {
    return NextResponse.json({ ok: false, error: existing.error }, { status: 500 });
  }
  const phones = new Set(existing.rows.map((row) => normalizePhone(row.phone)).filter(Boolean));
  const emails = new Set(existing.rows.map((row) => row.email.trim().toLowerCase()).filter(Boolean));
  const rows = [];
  const issues = [...parsed.issues];
  for (const row of parsed.rows) {
    const phone = normalizePhone(row.input.phone);
    const email = row.input.email.trim().toLowerCase();
    if (phone && phones.has(phone)) {
      issues.push({ line: row.line, message: `הטלפון ${phone} כבר רשום` });
      continue;
    }
    if (email && emails.has(email)) {
      issues.push({ line: row.line, message: `המייל ${email} כבר רשום` });
      continue;
    }
    if (phone) phones.add(phone);
    if (email) emails.add(email);
    rows.push(row);
  }
  return NextResponse.json({
    ok: true,
    rows: rows.map((row) => ({ line: row.line, input: row.input, minyanName: row.minyanName })),
    issues
  });
}
