-- התראות Push: מנויים, הודעות (מיידי / מתוזמן), וסינון לפי מניין.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  minyan_id uuid references public.minyanim(id) on delete set null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists idx_push_subscriptions_synagogue
  on public.push_subscriptions (synagogue_id);

create index if not exists idx_push_subscriptions_synagogue_minyan
  on public.push_subscriptions (synagogue_id, minyan_id);

create table if not exists public.push_messages (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  minyan_id uuid references public.minyanim(id) on delete set null,
  title text not null,
  body text not null,
  template_key text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_by text,
  success_count integer not null default 0,
  fail_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_messages_synagogue_created
  on public.push_messages (synagogue_id, created_at desc);

create index if not exists idx_push_messages_due
  on public.push_messages (scheduled_for)
  where status = 'scheduled';

alter table public.push_subscriptions enable row level security;
alter table public.push_messages enable row level security;

comment on table public.push_subscriptions is
  'מנויי Web Push לאפליקציית המתפללים, לפי בית כנסת (ומניין אופציונלי)';

comment on table public.push_messages is
  'הודעות שהגבאי שלח או תזמן; לחיצה על ההתראה פותחת דף ייעודי עם התוכן';
