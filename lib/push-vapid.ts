export function getVapidPublicKey(): string | null {
  const key = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "").trim();
  return key || null;
}

export function getVapidPrivateKey(): string | null {
  const key = (process.env.VAPID_PRIVATE_KEY || "").trim();
  return key || null;
}

export function getVapidSubject(): string {
  const subject = (process.env.VAPID_SUBJECT || "").trim();
  if (subject) return subject;
  return "mailto:synagogues.manager@gmail.com";
}

export function vapidConfigured(): boolean {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}
