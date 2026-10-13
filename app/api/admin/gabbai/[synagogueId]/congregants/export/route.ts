import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireGabbaiSynagogue } from "@/lib/congregant-access";
import { listCongregants } from "@/lib/congregant-db";
import { mapCongregantApiError } from "@/lib/congregant-errors";
import { buildRoster, rosterFilterFromSearch, type RosterColumnKey, type RosterRow } from "@/lib/congregant-roster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function esc(text: string) {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

function todayLabel() {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric" }).format(
    new Date()
  );
}

function xlsxResponse(rows: RosterRow[], columns: ReadonlyArray<{ key: RosterColumnKey; header: string }>) {
  const matrix = [columns.map((col) => col.header), ...rows.map((row) => columns.map((col) => row[col.key]))];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  sheet["!cols"] = columns.map((col) => ({
    wch: Math.min(40, Math.max(col.header.length + 2, ...rows.map((row) => row[col.key].length + 2)))
  }));
  sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: columns.length - 1 } }) };
  const book = XLSX.utils.book_new();
  book.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(book, sheet, "מתפללים");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(Uint8Array.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="congregants.xlsx"; filename*=UTF-8''${encodeURIComponent("רשימת מתפללים.xlsx")}`,
      "Cache-Control": "no-store"
    }
  });
}

/** דף הדפסה A4 — «שמירה כ-PDF» מחלון ההדפסה של הדפדפן */
function printResponse(
  title: string,
  subtitle: string,
  rows: RosterRow[],
  columns: ReadonlyArray<{ key: RosterColumnKey; header: string }>
) {
  const head = `<tr><th class="n">#</th>${columns.map((col) => `<th>${esc(col.header)}</th>`).join("")}</tr>`;
  const body = rows
    .map(
      (row, index) =>
        `<tr><td class="n">${index + 1}</td>${columns
          .map((col) => `<td${col.key === "lastName" ? ' class="last"' : ""}>${esc(row[col.key])}</td>`)
          .join("")}</tr>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4 ${columns.length > 7 ? "landscape" : "portrait"}; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1f1f1f; margin: 0; padding: 18px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { color: #666; font-size: 13px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #c9c9c9; padding: 5px 7px; text-align: right; vertical-align: top; }
  th { background: #eef1f3; font-weight: 700; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  td.n, th.n { width: 1%; color: #777; text-align: center; }
  td.last { font-weight: 700; }
  .bar { display: flex; gap: 8px; margin-bottom: 14px; }
  .bar button { font: inherit; font-size: 14px; padding: 7px 14px; border-radius: 8px; border: 1px solid #999; background: #fff; cursor: pointer; }
  .bar button.primary { background: #6b1a2e; color: #fff; border-color: #6b1a2e; }
  @media print { .bar { display: none; } body { padding: 0; } }
</style>
</head>
<body>
<div class="bar">
  <button class="primary" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
  <button onclick="window.close()">סגירה</button>
</div>
<h1>${esc(title)}</h1>
<p class="sub">${esc(subtitle)}</p>
<table><thead>${head}</thead><tbody>${body}</tbody></table>
<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });</script>
</body>
</html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(request: Request, context: { params: Promise<{ synagogueId: string }> }) {
  const { synagogueId: rawId } = await context.params;
  const access = await requireGabbaiSynagogue(rawId);
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "print" ? "print" : "xlsx";
  const filter = rosterFilterFromSearch(url.searchParams);

  const list = await listCongregants(access.synagogueId);
  if (list.error) {
    return format === "print"
      ? new NextResponse(`<p dir="rtl" style="font-family:sans-serif">${esc(mapCongregantApiError(list.error))}</p>`, {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" }
        })
      : NextResponse.json({ ok: false, error: list.error }, { status: 500 });
  }

  const { rows, columns } = buildRoster(list.rows, filter);
  if (format === "xlsx") return xlsxResponse(rows, columns);

  const [synagogueRes, minyanRes] = await Promise.all([
    access.supabase.from("synagogues").select("name").eq("id", access.synagogueId).maybeSingle(),
    filter.minyanId
      ? access.supabase.from("minyanim").select("name").eq("id", filter.minyanId).maybeSingle()
      : Promise.resolve({ data: null })
  ]);
  const synagogueName = String((synagogueRes.data as { name?: string } | null)?.name ?? "").trim();
  const minyanName = String((minyanRes.data as { name?: string } | null)?.name ?? "").trim();
  const title = ["רשימת מתפללים", synagogueName, minyanName].filter(Boolean).join(" · ");
  const subtitle = [`${rows.length} מתפללים`, "לפי א-ב של שם המשפחה", todayLabel()].join(" · ");
  return printResponse(title, subtitle, rows, columns);
}
