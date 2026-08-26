-- קטלוג מנחה/ערבית לפי פרשה (כולל חול המועד), לכל מניין בנפרד.
create table if not exists public.minyan_parasha_prayer_times (
  id uuid primary key default gen_random_uuid(),
  minyan_id uuid not null references public.minyanim(id) on delete cascade,
  parasha_key text not null,
  mincha_time time,
  maariv_time time,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (minyan_id, parasha_key)
);

create index if not exists minyan_parasha_prayer_times_minyan_id_idx
  on public.minyan_parasha_prayer_times (minyan_id);

comment on table public.minyan_parasha_prayer_times is
  'זמני מנחה וערבית לפי פרשת שבוע / חול המועד, ברמת מניין';
