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

  const host = process.env.CONTACT_SMTP_HOST;
  const user = process.env.CONTACT_SMTP_USER;
  const pass = process.env.CONTACT_SMTP_PASS;
  const port = Number(process.env.CONTACT_SMTP_PORT || "587");

  if (!host || !user || !pass) {
    return NextResponse.json({ ok: false, error: "mail_not_configured" }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

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
  } catch {
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
