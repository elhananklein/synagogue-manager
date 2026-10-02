import nodemailer from "nodemailer";

/** Gmail מציג App Password עם רווחים — מסירים אותם. */
function normalizeSecret(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function classifyMailError(err: unknown): string {
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

export async function sendSiteMail(message: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = (process.env.CONTACT_SMTP_HOST || "").trim();
  const user = (process.env.CONTACT_SMTP_USER || "").trim();
  const pass = normalizeSecret(process.env.CONTACT_SMTP_PASS || "");
  const port = Number(process.env.CONTACT_SMTP_PORT || "587");
  if (!host || !user || !pass) return { ok: false, error: "mail_not_configured" };
  if (!message.to.length) return { ok: false, error: "no_recipients" };

  const isGmail = /gmail\.com$/i.test(host) || /gmail\.com$/i.test(user);
  const transporter = nodemailer.createTransport(
    isGmail
      ? { service: "gmail", auth: { user, pass } }
      : { host, port, secure: port === 465, requireTLS: port === 587, auth: { user, pass } }
  );
  try {
    await transporter.sendMail({
      from: `"מערכת בתי כנסת" <${user}>`,
      to: message.to.join(", "),
      subject: message.subject,
      html: message.html,
      text: message.text
    });
    return { ok: true };
  } catch (err) {
    console.error("[mail] sendMail failed:", {
      code: (err as { code?: string })?.code,
      responseCode: (err as { responseCode?: number })?.responseCode,
      message: (err as { message?: string })?.message
    });
    return { ok: false, error: classifyMailError(err) };
  }
}
