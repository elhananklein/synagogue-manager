import type { AliyahDayKind } from "@/lib/aliyah-types";
import { normalizePhone } from "@/lib/congregant-types";

export const ALIYAH_MESSAGE_TEMPLATE_MAX = 600;
export const DONATION_URL_MAX = 500;

export const ALIYAH_MESSAGE_PLACEHOLDERS = [
  { token: "{ברכה}", label: "«שבוע טוב» אחרי שבת, «חג שמח» אחרי חג" },
  { token: "{שם}", label: "השם הפרטי של העולה" },
  { token: "{מתי}", label: "«בשבת פרשת נח» / «בסוכות» / «ביום שני, ט״ו בחשון»" },
  { token: "{בית_כנסת}", label: "שם בית הכנסת, בלי המילים «בית הכנסת»" },
  { token: "{קישור_תרומה}", label: "הקישור לתרומה מההגדרות" },
  { token: "{קישור_הסרה}", label: "הקישור האישי לביטול ההודעות — חובה" }
] as const;

export const ALIYAH_MESSAGE_OPT_OUT_TOKEN = "{קישור_הסרה}";

export const DEFAULT_ALIYAH_MESSAGE_TEMPLATE = [
  "{ברכה} {שם}, יישר כוח על העלייה לתורה {מתי} בבית הכנסת {בית_כנסת}.",
  "נשמח לתרומתך לבית הכנסת: {קישור_תרומה}",
  "",
  "להפסקת ההודעות: {קישור_הסרה}"
].join("\n");

export type AliyahMessageValues = {
  firstName: string;
  kind: AliyahDayKind;
  parashaLabel: string;
  weekday: string;
  hebrewDate: string;
  synagogueName: string;
  donationUrl: string;
  optOutUrl: string;
};

export function aliyahMessageGreeting(kind: AliyahDayKind) {
  if (kind === "shabbat") return "שבוע טוב";
  if (kind === "yom-tov") return "חג שמח";
  if (kind === "yom-kippur") return "גמר חתימה טובה";
  return "שלום";
}

export function aliyahMessageWhen(kind: AliyahDayKind, parashaLabel: string, weekday: string, hebrewDate: string) {
  const label = parashaLabel.trim().replace(/\s+ת[\u05D0-\u05EA]{0,3}[״"][\u05D0-\u05EA]$/, "");
  if (kind === "shabbat" && label) return label.startsWith("שבת") ? `ב${label}` : `בשבת פרשת ${label}`;
  if ((kind === "yom-tov" || kind === "yom-kippur") && label) return `ב${label}`;
  const day = weekday.trim() ? `ב${weekday.trim()}` : "";
  return [day, hebrewDate.trim()].filter(Boolean).join(", ");
}

function shortSynagogueName(name: string) {
  const stripped = name.replace(/^\s*בית[\s-]*(ה)?כנסת[\s-]*/u, "").trim();
  return stripped || name.trim();
}

export function resolveAliyahMessageTemplate(template: string | null | undefined) {
  const text = String(template ?? "").trim();
  return text || DEFAULT_ALIYAH_MESSAGE_TEMPLATE;
}

export function renderAliyahMessage(template: string | null | undefined, values: AliyahMessageValues) {
  const replacements: Record<string, string> = {
    "{ברכה}": aliyahMessageGreeting(values.kind),
    "{שם}": values.firstName.trim(),
    "{מתי}": aliyahMessageWhen(values.kind, values.parashaLabel, values.weekday, values.hebrewDate),
    "{בית_כנסת}": shortSynagogueName(values.synagogueName),
    "{קישור_תרומה}": values.donationUrl.trim(),
    "{קישור_הסרה}": values.optOutUrl
  };
  return resolveAliyahMessageTemplate(template).replace(/\{[^{}\s]+\}/g, (token) => replacements[token] ?? token);
}

export function validateAliyahMessageTemplate(template: string) {
  const text = template.trim();
  if (!text) return null;
  if (text.length > ALIYAH_MESSAGE_TEMPLATE_MAX) return "template_too_long";
  if (!text.includes(ALIYAH_MESSAGE_OPT_OUT_TOKEN)) return "template_missing_opt_out";
  return null;
}

export function normalizeDonationUrl(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  if (text.length > DONATION_URL_MAX) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** 05X-XXXXXXX → 9725XXXXXXXX. מחזיר null אם המספר לא נראה כמו טלפון ישראלי או בינלאומי. */
export function whatsappPhone(raw: string | null | undefined): string | null {
  const local = normalizePhone(raw);
  if (!local) return null;
  const digits = local.replace(/^\+/, "").replace(/\D/g, "");
  if (digits !== local.replace(/^\+/, "")) return null;
  if (digits.startsWith("0")) {
    const national = digits.slice(1);
    return national.length >= 8 && national.length <= 9 ? `972${national}` : null;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function messagesConsentPath(token: string) {
  return `/messages/${encodeURIComponent(token)}`;
}
