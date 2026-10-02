import { ALIYAH_DAY_KIND_LABELS } from "@/lib/aliyah-types";
import type { AliyahPlan, AliyahPlanCandidate } from "@/lib/aliyah-plan-types";

export type AliyahPlanHtmlPerson = { displayName: string; prayerName: string };

export type AliyahPlanHtmlInput = {
  plan: AliyahPlan;
  synagogueName: string;
  minyanName: string;
  people: Map<string, AliyahPlanHtmlPerson>;
  /** קישור לעמוד התכנון — במייל בלבד */
  plannerUrl?: string;
  forPrint?: boolean;
};

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const INK = "#1a2b33";
const MUTED = "#5d6b72";
const LINE = "#c9d2d6";
const GOLD = "#a86f12";
const GOLD_BG = "#fbf3e2";

function candidateHtml(item: AliyahPlanCandidate | null, people: Map<string, AliyahPlanHtmlPerson>, compact: boolean) {
  if (!item) return `<span style="color:${MUTED}">—</span>`;
  const person = people.get(item.congregantId);
  const prayer = person?.prayerName || person?.displayName || "מתפלל";
  const full = person?.displayName && person.displayName !== prayer ? person.displayName : "";
  const reasonColor = item.chiyuv ? GOLD : MUTED;
  const reasonWeight = item.chiyuv ? "700" : "400";
  if (compact) {
    return `<div style="margin:0 0 4px"><span style="font-weight:600">${esc(prayer)}</span>${
      full ? ` <span style="color:${MUTED};font-size:12px">(${esc(full)})</span>` : ""
    }${item.reason ? `<div style="font-size:11px;color:${reasonColor};font-weight:${reasonWeight}">${esc(item.reason)}</div>` : ""}</div>`;
  }
  return `<div style="font-size:17px;font-weight:700">${esc(prayer)}</div>${
    full ? `<div style="font-size:13px;color:${MUTED}">${esc(full)}</div>` : ""
  }${item.reason ? `<div style="font-size:12px;color:${reasonColor};font-weight:${reasonWeight};margin-top:2px">${esc(item.reason)}</div>` : ""}`;
}

/** גוף הדף — טבלה עם סגנונות inline, כדי שיוצג נכון גם בתיבות דואר. */
export function renderAliyahPlanBody(input: AliyahPlanHtmlInput): string {
  const { plan, people } = input;
  const cell = `border:1px solid ${LINE};padding:8px 10px;vertical-align:top;text-align:right`;
  const head = `${cell};background:#eef3f5;font-size:13px;color:${MUTED};font-weight:700`;

  const rows = plan.slots
    .map((slot) => {
      const chiyuv = Boolean(slot.primary?.chiyuv);
      const rowBg = chiyuv ? `background:${GOLD_BG};` : "";
      const note = slot.note ? `<div style="font-size:12px;color:#b3261e;margin-top:4px">${esc(slot.note)}</div>` : "";
      return `<tr style="${rowBg}">
  <td style="${cell};font-weight:700;font-size:16px;white-space:nowrap;width:1%">${esc(slot.label)}</td>
  <td style="${cell}">${candidateHtml(slot.primary, people, false)}${note}</td>
  <td style="${cell};width:30%">${slot.backups.length ? slot.backups.map((item) => candidateHtml(item, people, true)).join("") : `<span style="color:${MUTED}">—</span>`}</td>
  <td style="${cell};width:22%">&nbsp;</td>
</tr>`;
    })
    .join("\n");

  const unplaced = plan.unplaced.length
    ? `<h3 style="margin:18px 0 6px;font-size:16px;color:${GOLD}">חיובים שלא נמצא להם מקום</h3>
<ul style="margin:0;padding:0 18px 0 0;font-size:14px">${plan.unplaced
        .map((item) => `<li><strong>${esc(item.name)}</strong> — ${esc(item.reason)}</li>`)
        .join("")}</ul>`
    : "";

  const hashkavot = plan.hashkavot.length
    ? `<h3 style="margin:18px 0 6px;font-size:16px">השכבות / אזכרות השבוע</h3>
<ul style="margin:0;padding:0 18px 0 0;font-size:14px">${plan.hashkavot
        .map(
          (item) =>
            `<li><strong>${esc(item.congregantName)}</strong> — ${esc(item.relationLabel)}${
              item.personName ? ` ${esc(item.personName)}` : ""
            } <span style="color:${MUTED}">(${esc(item.dateLabel)})</span></li>`
        )
        .join("")}</ul>`
    : "";

  const link = input.plannerUrl
    ? `<p style="margin:16px 0 0;font-size:14px"><a href="${esc(input.plannerUrl)}" style="color:${GOLD}">לעריכת התכנון במערכת</a></p>`
    : "";

  return `<div dir="rtl" style="font-family:Arial,'Segoe UI',sans-serif;color:${INK};max-width:820px;margin:0 auto">
  <div style="font-size:13px;color:${MUTED}">${esc(input.synagogueName)}${input.minyanName ? ` · ${esc(input.minyanName)}` : ""}</div>
  <h1 style="margin:4px 0 2px;font-size:24px">עולים לתורה — ${esc(plan.title || ALIYAH_DAY_KIND_LABELS[plan.kind])}</h1>
  <div style="font-size:14px;color:${MUTED};margin-bottom:12px">${esc(plan.civilDate)}${plan.hebrewDate ? ` · ${esc(plan.hebrewDate)}` : ""}</div>
  <table style="border-collapse:collapse;width:100%;font-size:14px" cellpadding="0" cellspacing="0">
    <thead><tr>
      <th style="${head}">עלייה</th>
      <th style="${head}">מומלץ</th>
      <th style="${head}">מחליפים</th>
      <th style="${head}">עלה בפועל</th>
    </tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <div style="font-size:12px;color:${MUTED};margin-top:6px">שורה מודגשת = חיוב (יארצייט, בר מצווה, חתן וכו׳). אם המומלץ לא הגיע — קוראים לאחד המחליפים.</div>
  ${unplaced}
  ${hashkavot}
  <p style="margin:18px 0 0;font-size:13px;color:${MUTED}">אחרי השבת: רשמו במערכת מי עלה בפועל (עליות ← רישום), כדי שההמלצות הבאות יתחשבו בכך.</p>
  ${link}
</div>`;
}

export function renderAliyahPlanDocument(input: AliyahPlanHtmlInput): string {
  const title = `עולים לתורה — ${input.plan.title}`;
  const printBar = input.forPrint
    ? `<div class="no-print" style="text-align:center;margin:0 0 16px">
  <button onclick="window.print()" style="font-size:16px;padding:8px 22px;border-radius:8px;border:1px solid ${GOLD};background:${GOLD};color:#fff;cursor:pointer">הדפסה</button>
</div>`
    : "";
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { margin: 0; padding: 20px; background: #fff; }
  @media print {
    .no-print { display: none !important; }
    body { padding: 0; }
    @page { size: A4; margin: 12mm; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
${printBar}
${renderAliyahPlanBody(input)}
</body>
</html>`;
}

export function renderAliyahPlanText(input: AliyahPlanHtmlInput): string {
  const { plan, people } = input;
  const name = (item: AliyahPlanCandidate | null) => {
    if (!item) return "—";
    const person = people.get(item.congregantId);
    return `${person?.prayerName || person?.displayName || "מתפלל"}${item.reason ? ` (${item.reason})` : ""}`;
  };
  const lines = [
    `עולים לתורה — ${plan.title}`,
    `${plan.civilDate} · ${plan.hebrewDate}`,
    "",
    ...plan.slots.map((slot) => {
      const backups = slot.backups.map((item) => people.get(item.congregantId)?.prayerName || "").filter(Boolean);
      return `${slot.label}: ${name(slot.primary)}${backups.length ? ` | מחליפים: ${backups.join(", ")}` : ""}`;
    })
  ];
  if (plan.hashkavot.length) {
    lines.push("", "השכבות:");
    for (const item of plan.hashkavot) lines.push(`- ${item.congregantName}: ${item.relationLabel} ${item.personName}`.trim());
  }
  if (input.plannerUrl) lines.push("", input.plannerUrl);
  return lines.join("\n");
}
