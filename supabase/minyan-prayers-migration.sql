-- Run this on existing projects to support multiple prayers per minyan
-- with weekday multi-select and separate Shabbat prayers.

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

drop trigger if exists trg_minyan_prayers_updated_at on public.minyan_prayers;
create trigger trg_minyan_prayers_updated_at
before update on public.minyan_prayers
for each row execute function public.set_updated_at();

