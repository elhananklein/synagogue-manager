export const PUSH_TITLE_MAX = 80;
export const PUSH_BODY_MAX = 280;

export const PUSH_MESSAGE_STATUSES = ["scheduled", "sending", "sent", "cancelled", "failed"] as const;
export type PushMessageStatus = (typeof PUSH_MESSAGE_STATUSES)[number];

export type PushSubscriptionRecord = {
  id: string;
  synagogueId: string;
  minyanId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
};

export type PushMessageRecord = {
  id: string;
  synagogueId: string;
  minyanId: string | null;
  title: string;
  body: string;
  templateKey: string | null;
  status: PushMessageStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  createdBy: string | null;
  successCount: number;
  failCount: number;
  createdAt: string;
};

export type PushTemplate = {
  key: string;
  title: string;
  body: string;
};

/** תבניות מוכנות לגבאי — אפשר לערוך לפני שליחה */
export const PUSH_TEMPLATES: PushTemplate[] = [
  {
    key: "prayer_time_change",
    title: "שינוי בשעת תפילה",
    body: "שימו לב: חל שינוי בשעות התפילה בבית הכנסת. לפרטים לחצו על ההתראה."
  },
  {
    key: "mincha_reminder",
    title: "תזכורת למנחה",
    body: "תפילת מנחה מתקיימת היום בבית הכנסת. נשמח לראותכם."
  },
  {
    key: "maariv_reminder",
    title: "תזכורת לערבית",
    body: "תפילת ערבית מתקיימת היום בבית הכנסת. נשמח לראותכם."
  },
  {
    key: "general_notice",
    title: "הודעה מבית הכנסת",
    body: "יש עדכון חשוב מבית הכנסת. לפרטים לחצו על ההתראה."
  },
  {
    key: "shabbat_welcome",
    title: "שבת שלום",
    body: "מאחלים שבת שלום ומבורכת. זמני התפילות באפליקציה."
  }
];

export function pushTemplateByKey(key: string | null | undefined): PushTemplate | null {
  if (!key) return null;
  return PUSH_TEMPLATES.find((item) => item.key === key) ?? null;
}

export function pushMessagePath(synagogueId: string, messageId: string) {
  return `/m/message/${encodeURIComponent(synagogueId)}/${encodeURIComponent(messageId)}`;
}
