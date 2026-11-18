-- לוח שיעורים + מסגרות (ערבי לימוד) ברמת בית כנסת.
-- מסך «לוח זמנים מלא»: האם לשלב שיעורים ב־10 הקוביות (לכל מניין).

create table if not exists public.synagogue_lesson_series (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  name text not null,
  audience text,
  price text,
  display_as_group boolean not null default false,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_synagogue_lesson_series_synagogue
  on public.synagogue_lesson_series (synagogue_id, sort_order);

drop trigger if exists trg_synagogue_lesson_series_updated_at on public.synagogue_lesson_series;
create trigger trg_synagogue_lesson_series_updated_at
before update on public.synagogue_lesson_series
for each row execute function public.set_updated_at();

comment on table public.synagogue_lesson_series is
  'מסגרת / ערב לימוד: שם, קהל, מחיר חודשי, והאם להציג כפריט אחד';

create table if not exists public.synagogue_lessons (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  series_id uuid references public.synagogue_lesson_series(id) on delete set null,
  -- בדיוק אחד מ־weekday / lesson_date (נבדק באפליקציה)
  weekday smallint check (weekday is null or (weekday >= 0 and weekday <= 6)),
  lesson_date date,
  start_time time not null,
  topic text,
  speaker text,
  audience text,
  price text,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint synagogue_lessons_schedule_xor check (
    (weekday is not null and lesson_date is null)
    or (weekday is null and lesson_date is not null)
  )
);

create index if not exists idx_synagogue_lessons_synagogue
  on public.synagogue_lessons (synagogue_id, sort_order);

create index if not exists idx_synagogue_lessons_series
  on public.synagogue_lessons (series_id)
  where series_id is not null;

create index if not exists idx_synagogue_lessons_date
  on public.synagogue_lessons (synagogue_id, lesson_date)
  where lesson_date is not null;

create index if not exists idx_synagogue_lessons_weekday
  on public.synagogue_lessons (synagogue_id, weekday)
  where weekday is not null;

drop trigger if exists trg_synagogue_lessons_updated_at on public.synagogue_lessons;
create trigger trg_synagogue_lessons_updated_at
before update on public.synagogue_lessons
for each row execute function public.set_updated_at();

comment on table public.synagogue_lessons is
  'שיעור בודד: חוזר לפי יום בשבוע או חד־פעמי לפי תאריך; יכול להיות משויך למסגרת';

alter table public.minyanim
  add column if not exists full_schedule_show_lessons boolean not null default true;

comment on column public.minyanim.full_schedule_show_lessons is
  'מסך «לוח זמנים מלא»: true = לשלב גם שיעורים בקוביות לפי שעה';
