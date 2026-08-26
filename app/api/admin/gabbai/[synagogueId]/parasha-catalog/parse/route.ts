import { NextResponse } from "next/server";
import { canManageSynagogue, getAdminContext } from "@/lib/auth";
import { fetchJerusalemParashaCatalogKeys } from "@/lib/parasha-catalog-hebcal";
import { parseParashaPrayerTable, withParashaCatalogSelectKeys } from "@/lib/parasha-prayer-catalog";
import * as XLSX from "xlsx";

const MAX_BYTES = 2 * 1024 * 1024;

async function requireAccess(synagogueId: string) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!canManageSynagogue(ctx, synagogueId))
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  return null;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId } = await context.params;
  const denied = await requireAccess(synagogueId);
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  const name = file.name.toLowerCase();
  const allowedExt = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
  if (!allowedExt) {
    return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
  }

  const allowedKeys = withParashaCatalogSelectKeys(await fetchJerusalemParashaCatalogKeys());
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return NextResponse.json({ ok: true, rows: [], warnings: [{ line: 1, message: "הקובץ ריק" }], allowedKeys });
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
  const parsed = parseParashaPrayerTable(matrix, allowedKeys);
  return NextResponse.json({
    ok: true,
    rows: parsed.rows,
    warnings: parsed.warnings,
    allowedKeys
  });
}
