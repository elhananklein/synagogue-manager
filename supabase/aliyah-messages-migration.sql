-- הודעות לעולים: אישור קבלת הודעות במתפלל, קישור תרומה ונוסח הודעה בבית הכנסת,
-- ויומן של הודעות וואטסאפ שהגבאי פתח מתוך גיליון העליות.

alter table public.congregants
  add column if not exists messages_consent boolean not null default false,
  add column if not exists messages_consent_at timestamptz,
  add column if not exists messages_consent_source text,
  add column if not exists messages_token uuid not null default gen_random_uuid();

alter table public.congregants
  drop constraint if exists congregants_messages_consent_source_check;

alter table public.congregants
  add constraint congregants_messages_consent_source_check
  check (messages_consent_source is null or messages_consent_source in ('self_join', 'gabbai', 'link'));

create unique index if not exists idx_congregants_messages_token
  on public.congregants (messages_token);

comment on column public.congregants.messages_consent is
  'האם המתפלל אישר לקבל הודעות (וואטסאפ / SMS) מבית הכנסת';
comment on column public.congregants.messages_consent_at is
  'מתי האישור ניתן או בוטל לאחרונה';
comment on column public.congregants.messages_consent_source is
  'מי שינה לאחרונה: self_join = טופס ההרשמה, gabbai = הגבאי, link = הקישור האישי';
comment on column public.congregants.messages_token is
  'מזהה אקראי לקישור האישי לאישור / ביטול הודעות';

alter table public.synagogues
  add column if not exists donation_url text,
  add column if not exists aliyah_message_template text;

comment on column public.synagogues.donation_url is
  'קישור קבוע לתרומה (JGive או אחר) שנכנס להודעה לעולים';
comment on column public.synagogues.aliyah_message_template is
  'נוסח ההודעה לעולים. ריק = נוסח ברירת המחדל';

create table if not exists public.aliyah_message_log (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  minyan_id uuid references public.minyanim(id) on delete set null,
  service_date date not null,
  congregant_id uuid references public.congregants(id) on delete set null,
  channel text not null default 'whatsapp_manual' check (channel in ('whatsapp_manual')),
  opened_by uuid,
  opened_at timestamptz not null default now()
);

create index if not exists idx_aliyah_message_log_synagogue
  on public.aliyah_message_log (synagogue_id, opened_at desc);

create index if not exists idx_aliyah_message_log_sheet
  on public.aliyah_message_log (minyan_id, service_date);

alter table public.aliyah_message_log enable row level security;

comment on table public.aliyah_message_log is
  'כל לחיצה של הגבאי על «שליחה בוואטסאפ» לעולה. הבסיס לספירת הודעות בדוח החודשי.';
