-- עליות לתורה: רישום מי עלה בשבת ובחגים (שחרית), לפי מניין.
-- לא כולל קריאת חול. מנחה תתווסף בנפרד אם יידרש.

create table if not exists public.aliyah_sessions (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  minyan_id uuid not null references public.minyanim(id) on delete cascade,
  service_date date not null,
  service_key text not null default 'shacharit' check (service_key in ('shacharit')),
  parasha_label text,
  hebrew_date_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (minyan_id, service_date, service_key)
);

create index if not exists idx_aliyah_sessions_synagogue_date
  on public.aliyah_sessions (synagogue_id, service_date desc);

create table if not exists public.aliyah_assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.aliyah_sessions(id) on delete cascade,
  slot_key text not null,
  sort_order integer not null default 0,
  congregant_id uuid references public.congregants(id) on delete set null,
  no_kohen_resolution text check (
    no_kohen_resolution is null or no_kohen_resolution in ('yisrael', 'skip')
  ),
  notes text,
  unique (session_id, slot_key)
);

create index if not exists idx_aliyah_assignments_session
  on public.aliyah_assignments (session_id, sort_order);

create index if not exists idx_aliyah_assignments_congregant
  on public.aliyah_assignments (congregant_id)
  where congregant_id is not null;

drop trigger if exists trg_aliyah_sessions_updated_at on public.aliyah_sessions;
create trigger trg_aliyah_sessions_updated_at
before update on public.aliyah_sessions
for each row execute function public.set_updated_at();

alter table public.aliyah_sessions enable row level security;
alter table public.aliyah_assignments enable row level security;

comment on table public.aliyah_sessions is
  'גיליון עליות ליום קריאה (שבת/חג) במניין';

comment on table public.aliyah_assignments is
  'מי עלה בכל עלייה בגיליון';
