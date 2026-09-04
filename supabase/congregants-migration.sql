-- מתפללים: כרטיס אדם לפי בית כנסת, נפרד ממשתמשי ניהול (admin_users).
-- עליות ותרומות יתייחסו לטבלה הזו בהמשך.

create table if not exists public.congregants (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  minyan_id uuid references public.minyanim(id) on delete set null,

  first_name text not null,
  middle_name text,
  last_name text not null,
  nickname text,
  father_name text,
  mother_name text,

  tribe text not null default 'yisrael' check (tribe in ('kohen', 'levi', 'yisrael')),

  gregorian_birth_date date not null,
  hebrew_birth_year integer not null check (hebrew_birth_year between 5000 and 6000),
  hebrew_birth_month integer not null check (hebrew_birth_month between 1 and 13),
  hebrew_birth_day integer not null check (hebrew_birth_day between 1 and 30),
  born_after_sunset boolean not null default false,

  phone text,
  email text,

  is_active boolean not null default true,
  receives_aliyah boolean not null default true,
  registration_status text not null default 'approved' check (registration_status in ('pending', 'approved')),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_congregants_synagogue
  on public.congregants (synagogue_id, last_name, first_name);

create index if not exists idx_congregants_minyan
  on public.congregants (minyan_id)
  where minyan_id is not null;

create unique index if not exists idx_congregants_synagogue_phone
  on public.congregants (synagogue_id, phone)
  where phone is not null and length(trim(phone)) > 0;

create unique index if not exists idx_congregants_synagogue_email
  on public.congregants (synagogue_id, lower(email))
  where email is not null and length(trim(email)) > 0;

create index if not exists idx_congregants_pending
  on public.congregants (synagogue_id, created_at desc)
  where registration_status = 'pending';

drop trigger if exists trg_congregants_updated_at on public.congregants;
create trigger trg_congregants_updated_at
before update on public.congregants
for each row execute function public.set_updated_at();

alter table public.congregants enable row level security;

comment on table public.congregants is
  'מתפללים רשומים בבית כנסת. לא משתמשי ניהול.';

comment on column public.congregants.tribe is
  'כהן / לוי / ישראל';

comment on column public.congregants.hebrew_birth_month is
  'חודש עברי לפי Hebcal: 1 ניסן … 12 אדר א, 13 אדר ב';

comment on column public.congregants.born_after_sunset is
  'אם נולד אחרי השקיעה, התאריך העברי הוא היום שאחרי התאריך הלועזי';
