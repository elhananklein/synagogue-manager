-- Multi-synagogue management model

create table if not exists public.synagogues (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.minyanim (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  name text not null,
  display_style text not null default 'classic' check (display_style in ('classic', 'modern', 'minimal', 'woodSilver')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_minyanim_synagogue_id on public.minyanim(synagogue_id);

create table if not exists public.minyan_prayer_settings (
  id uuid primary key default gen_random_uuid(),
  minyan_id uuid not null references public.minyanim(id) on delete cascade,
  prayer_type text not null check (prayer_type in ('שחרית', 'מנחה', 'ערבית')),
  mode text not null default 'fixed' check (mode in ('fixed', 'relative')),
  fixed_time time,
  zman_anchor text,
  offset_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(minyan_id, prayer_type)
);

create table if not exists public.minyan_display_screens (
  id uuid primary key default gen_random_uuid(),
  minyan_id uuid not null references public.minyanim(id) on delete cascade,
  screen_key text not null check (screen_key in ('main', 'clock', 'halacha')),
  sort_order integer not null default 0,
  duration_seconds integer not null default 20 check (duration_seconds between 5 and 600),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(minyan_id, screen_key)
);

create table if not exists public.minyan_prayers (
  id uuid primary key default gen_random_uuid(),
  minyan_id uuid not null references public.minyanim(id) on delete cascade,
  category text not null check (category in ('weekday', 'shabbat')),
  prayer_type text not null check (prayer_type in ('שחרית', 'מנחה', 'ערבית', 'מנחה ערב שבת', 'שחרית שבת', 'מנחה שבת', 'ערבית מוצ''ש')),
  days_of_week smallint[] not null default '{}'::smallint[],
  mode text not null default 'fixed' check (mode in ('fixed', 'relative')),
  fixed_time time,
  zman_anchor text,
  offset_minutes integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_synagogues_updated_at on public.synagogues;
create trigger trg_synagogues_updated_at
before update on public.synagogues
for each row execute function public.set_updated_at();

drop trigger if exists trg_minyanim_updated_at on public.minyanim;
create trigger trg_minyanim_updated_at
before update on public.minyanim
for each row execute function public.set_updated_at();

drop trigger if exists trg_minyan_prayer_settings_updated_at on public.minyan_prayer_settings;
create trigger trg_minyan_prayer_settings_updated_at
before update on public.minyan_prayer_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_minyan_display_screens_updated_at on public.minyan_display_screens;
create trigger trg_minyan_display_screens_updated_at
before update on public.minyan_display_screens
for each row execute function public.set_updated_at();

drop trigger if exists trg_minyan_prayers_updated_at on public.minyan_prayers;
create trigger trg_minyan_prayers_updated_at
before update on public.minyan_prayers
for each row execute function public.set_updated_at();

