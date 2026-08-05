import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

const TO_EMAIL = process.env.CONTACT_TO_EMAIL || "synagogues.manager@gmail.com";
const MAX_MESSAGE = 4000;
const MAX_FIELD = 200;

type Body = {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  /** honeypot — אם מולא, מתעלמים בשקט */
  website?: string;
};

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/** Gmail מציג App Password עם רווחים — מסירים אותם. */
function normalizeSecret(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

function classifyMailError(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err ?? "").toLowerCase();
  const code = String((err as { code?: string })?.code ?? "").toLowerCase();
  const responseCode = Number((err as { responseCode?: number })?.responseCode ?? 0);

  if (
    code === "eauth" ||
    responseCode === 535 ||
    msg.includes("invalid login") ||
    msg.includes("username and password not accepted") ||
    msg.includes("badcredentials") ||
    msg.includes("authentication failed")
  ) {
    return "smtp_auth_failed";
  }
  if (code === "eenvelope" || msg.includes("envelope")) return "smtp_envelope_failed";
  if (code === "econrefused" || code === "etimedout" || code === "esocket") return "smtp_connect_failed";
  return "send_failed";
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // בוטים שממלאים honeypot
  if (clean(body.website, 100)) {
    return NextResponse.json({ ok: true });
  }

  const name = clean(body.name, MAX_FIELD);
  const email = clean(body.email, MAX_FIELD);
  const phone = clean(body.phone, MAX_FIELD);
  const message = clean(body.message, MAX_MESSAGE);

  if (!message) {
    return NextResponse.json({ ok: false, error: "message_required" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const host = (process.env.CONTACT_SMTP_HOST || "").trim();
  const user = (process.env.CONTACT_SMTP_USER || "").trim();
  const pass = normalizeSecret(process.env.CONTACT_SMTP_PASS || "");
  const port = Number(process.env.CONTACT_SMTP_PORT || "587");

  if (!host || !user || !pass) {
    return NextResponse.json({ ok: false, error: "mail_not_configured" }, { status: 500 });
  }

  const isGmail = /gmail\.com$/i.test(host) || /gmail\.com$/i.test(user);
  const transporter = nodemailer.createTransport(
    isGmail
      ? {
          service: "gmail",
          auth: { user, pass }
        }
      : {
          host,
          port,
          secure: port === 465,
          requireTLS: port === 587,
          auth: { user, pass }
        }
  );

  const lines = [
    "פנייה חדשה מדף צור קשר",
    "",
    `שם: ${name || "—"}`,
    `אימייל: ${email || "—"}`,
    `טלפון: ${phone || "—"}`,
    "",
    "הודעה:",
    message
  ];

  try {
    await transporter.sendMail({
      from: `"מערכת בתי כנסת" <${user}>`,
      to: TO_EMAIL,
      replyTo: email || undefined,
      subject: name ? `פנייה מאת ${name}` : "פנייה מדף צור קשר",
      text: lines.join("\n")
    });
  } catch (err) {
    console.error("[contact] sendMail failed:", {
      code: (err as { code?: string })?.code,
      responseCode: (err as { responseCode?: number })?.responseCode,
      message: (err as { message?: string })?.message
    });
    return NextResponse.json({ ok: false, error: classifyMailError(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
