-- תכנון עליות לשבת/חג הקרובים: הגדרות מנהג למניין, חיובים ידניים, ותכנון שמור.
-- הרישום של מי עלה בפועל נשאר ב־aliyah_sessions / aliyah_assignments.

create table if not exists public.minyan_aliyah_settings (
  minyan_id uuid primary key references public.minyanim(id) on delete cascade,
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  yahrzeit_timing text not null default 'shabbat_before'
    check (yahrzeit_timing in ('shabbat_before', 'shabbat_of_week')),
  yahrzeit_scope text not null default 'all'
    check (yahrzeit_scope in ('parents', 'all')),
  maftir_for_yahrzeit boolean not null default true,
  maftir_for_bar_mitzvah boolean not null default true,
  separate_relatives boolean not null default true,
  extra_aliyot_for_chiyuvim boolean not null default true,
  backups_count integer not null default 2 check (backups_count between 0 and 3),
  min_weeks_between integer not null default 3 check (min_weeks_between between 0 and 26),
  priority_order text[] not null default array[
    'chatan', 'bar_mitzvah', 'father_of_baby', 'yahrzeit_parent',
    'bar_mitzvah_father', 'yahrzeit_other', 'guest', 'other'
  ],
  email_enabled boolean not null default true,
  email_recipients text,
  updated_at timestamptz not null default now()
);

create table if not exists public.aliyah_chiyuv_events (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  minyan_id uuid not null references public.minyanim(id) on delete cascade,
  congregant_id uuid not null references public.congregants(id) on delete cascade,
  service_date date not null,
  kind text not null check (kind in ('chatan', 'bar_mitzvah', 'father_of_baby', 'guest', 'other')),
  preferred_slot text,
  notes text,
  created_at timestamptz not null default now(),
  unique (minyan_id, service_date, congregant_id)
);

create index if not exists idx_aliyah_chiyuv_events_date
  on public.aliyah_chiyuv_events (minyan_id, service_date);

create table if not exists public.aliyah_plans (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  minyan_id uuid not null references public.minyanim(id) on delete cascade,
  service_date date not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (minyan_id, service_date)
);

create table if not exists public.aliyah_plan_slots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.aliyah_plans(id) on delete cascade,
  slot_key text not null,
  sort_order integer not null default 0,
  rank smallint not null default 0 check (rank between 0 and 3),
  congregant_id uuid references public.congregants(id) on delete set null,
  reason text,
  locked boolean not null default false,
  unique (plan_id, slot_key, rank)
);

create index if not exists idx_aliyah_plan_slots_plan
  on public.aliyah_plan_slots (plan_id, sort_order, rank);

drop trigger if exists trg_aliyah_plans_updated_at on public.aliyah_plans;
create trigger trg_aliyah_plans_updated_at
before update on public.aliyah_plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_minyan_aliyah_settings_updated_at on public.minyan_aliyah_settings;
create trigger trg_minyan_aliyah_settings_updated_at
before update on public.minyan_aliyah_settings
for each row execute function public.set_updated_at();

alter table public.minyan_aliyah_settings enable row level security;
alter table public.aliyah_chiyuv_events enable row level security;
alter table public.aliyah_plans enable row level security;
alter table public.aliyah_plan_slots enable row level security;

comment on table public.minyan_aliyah_settings is 'מנהגי המניין לחישוב המלצות עליות';
comment on table public.aliyah_chiyuv_events is 'חיובים שהגבאי מזין ידנית: חתן, אבי הבן, אורח וכו׳';
comment on table public.aliyah_plans is 'תכנון עליות שמור ליום קריאה';
comment on table public.aliyah_plan_slots is 'בכל עלייה: rank 0 = מומלץ, 1-3 = מחליפים';
