-- Enable useful extension
create extension if not exists "pgcrypto";

-- Members of the synagogue community
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  hebrew_name text,
  phone text,
  email text unique,
  street_address text,
  city text default 'ירושלים',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prayer schedule by date and prayer type
create table if not exists public.prayer_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_date date not null,
  prayer_type text not null check (prayer_type in ('שחרית', 'מנחה', 'ערבית', 'מוסף')),
  prayer_time time not null,
  minyan_label text,
  notes text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prayer_schedules_date on public.prayer_schedules (schedule_date);

-- Daily halacha content shown publicly
create table if not exists public.daily_halacha (
  id uuid primary key default gen_random_uuid(),
  halacha_date date not null unique,
  title text not null,
  content text not null,
  source text,
  published boolean not null default false,
  created_by uuid references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Torah lessons and events
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  lesson_title text not null,
  speaker_name text not null,
  lesson_date date not null,
  start_time time not null,
  end_time time,
  location text default 'בית הכנסת',
  category text default 'שיעור',
  notes text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Donation records
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_member_id uuid references public.members(id),
  donor_name text,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'ILS',
  donation_date date not null default current_date,
  donation_type text default 'כללי',
  dedication text,
  payment_method text default 'מזומן',
  receipt_number text unique,
  created_at timestamptz not null default now()
);

-- Seat assignments for holidays / regular seats
create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  seat_code text not null unique,
  section_name text not null,
  seat_type text default 'קבוע',
  assigned_member_id uuid references public.members(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Basic trigger for updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_members_updated_at on public.members;
create trigger trg_members_updated_at
before update on public.members
for each row execute function public.set_updated_at();

drop trigger if exists trg_prayer_schedules_updated_at on public.prayer_schedules;
create trigger trg_prayer_schedules_updated_at
before update on public.prayer_schedules
for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_halacha_updated_at on public.daily_halacha;
create trigger trg_daily_halacha_updated_at
before update on public.daily_halacha
for each row execute function public.set_updated_at();

drop trigger if exists trg_lessons_updated_at on public.lessons;
create trigger trg_lessons_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

drop trigger if exists trg_seats_updated_at on public.seats;
create trigger trg_seats_updated_at
before update on public.seats
for each row execute function public.set_updated_at();

-- Helpful initial seed data
insert into public.prayer_schedules (schedule_date, prayer_type, prayer_time, minyan_label, notes, published)
values
  (current_date, 'שחרית', '05:45', 'ותיקין', null, true),
  (current_date, 'שחרית', '07:00', 'מרכזי', null, true),
  (current_date, 'מנחה', '18:25', 'יומי', '20 דקות לפני שקיעה', true),
  (current_date, 'ערבית', '19:10', 'יומי', null, true)
on conflict do nothing;

insert into public.daily_halacha (halacha_date, title, content, source, published)
values
  (
    current_date,
    'הלכה יומית - ברכות הנהנין',
    'לפני אכילת עוגה מברכים מזונות, ולאחריה - על המחיה, אם אכלו כשיעור.',
    'שולחן ערוך אורח חיים',
    true
  )
on conflict (halacha_date) do nothing;
