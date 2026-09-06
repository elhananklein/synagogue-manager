-- יארצייטים: שבעה קרובים + סבא וסבתא. מעתיק גם פטירת אב/אם הקיימת.

create table if not exists public.congregant_yahrzeits (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  congregant_id uuid not null references public.congregants(id) on delete cascade,
  relation text not null check (
    relation in (
      'father',
      'mother',
      'son',
      'daughter',
      'brother',
      'sister',
      'spouse',
      'grandfather',
      'grandmother'
    )
  ),
  person_name text not null default '',
  gregorian_date date,
  hebrew_year integer,
  hebrew_month integer,
  hebrew_day integer,
  after_sunset boolean not null default false,
  created_at timestamptz not null default now(),
  check (hebrew_year is null or hebrew_year between 5000 and 6000)
);

create index if not exists idx_congregant_yahrzeits_congregant
  on public.congregant_yahrzeits (synagogue_id, congregant_id);

alter table public.congregant_yahrzeits enable row level security;

insert into public.congregant_yahrzeits (
  synagogue_id,
  congregant_id,
  relation,
  person_name,
  gregorian_date,
  hebrew_year,
  hebrew_month,
  hebrew_day,
  after_sunset
)
select
  synagogue_id,
  id,
  'father',
  coalesce(father_name, ''),
  father_died_gregorian_date,
  father_died_hebrew_year,
  father_died_hebrew_month,
  father_died_hebrew_day,
  coalesce(father_died_after_sunset, false)
from public.congregants
where
  (father_died_gregorian_date is not null or father_died_hebrew_year is not null)
  and not exists (
    select 1
    from public.congregant_yahrzeits y
    where y.congregant_id = congregants.id
      and y.relation = 'father'
  );

insert into public.congregant_yahrzeits (
  synagogue_id,
  congregant_id,
  relation,
  person_name,
  gregorian_date,
  hebrew_year,
  hebrew_month,
  hebrew_day,
  after_sunset
)
select
  synagogue_id,
  id,
  'mother',
  coalesce(mother_name, ''),
  mother_died_gregorian_date,
  mother_died_hebrew_year,
  mother_died_hebrew_month,
  mother_died_hebrew_day,
  coalesce(mother_died_after_sunset, false)
from public.congregants
where
  (mother_died_gregorian_date is not null or mother_died_hebrew_year is not null)
  and not exists (
    select 1
    from public.congregant_yahrzeits y
    where y.congregant_id = congregants.id
      and y.relation = 'mother'
  );

comment on table public.congregant_yahrzeits is
  'יארצייט של קרוב — שבעה קרובים או סבא/סבתא';
