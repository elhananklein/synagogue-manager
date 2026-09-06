-- מגדר, יארצייט הורים, וקישור בני משפחה בין מתפללים.

alter table public.congregants
  add column if not exists gender text;

update public.congregants
set gender = 'male'
where gender is null or btrim(gender) = '';

alter table public.congregants
  alter column gender set default 'male';

alter table public.congregants
  alter column gender set not null;

alter table public.congregants
  drop constraint if exists congregants_gender_check;

alter table public.congregants
  add constraint congregants_gender_check
  check (gender in ('male', 'female'));

alter table public.congregants
  add column if not exists father_died_gregorian_date date,
  add column if not exists father_died_hebrew_year integer,
  add column if not exists father_died_hebrew_month integer,
  add column if not exists father_died_hebrew_day integer,
  add column if not exists father_died_after_sunset boolean not null default false,
  add column if not exists mother_died_gregorian_date date,
  add column if not exists mother_died_hebrew_year integer,
  add column if not exists mother_died_hebrew_month integer,
  add column if not exists mother_died_hebrew_day integer,
  add column if not exists mother_died_after_sunset boolean not null default false;

alter table public.congregants
  drop constraint if exists congregants_father_death_year_check;
alter table public.congregants
  add constraint congregants_father_death_year_check
  check (father_died_hebrew_year is null or father_died_hebrew_year between 5000 and 6000);

alter table public.congregants
  drop constraint if exists congregants_mother_death_year_check;
alter table public.congregants
  add constraint congregants_mother_death_year_check
  check (mother_died_hebrew_year is null or mother_died_hebrew_year between 5000 and 6000);

create table if not exists public.congregant_relations (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  congregant_id uuid not null references public.congregants(id) on delete cascade,
  related_id uuid not null references public.congregants(id) on delete cascade,
  relation text not null check (relation in ('son', 'daughter', 'husband', 'wife')),
  created_at timestamptz not null default now(),
  unique (congregant_id, related_id),
  check (congregant_id <> related_id)
);

create index if not exists idx_congregant_relations_congregant
  on public.congregant_relations (synagogue_id, congregant_id);

create index if not exists idx_congregant_relations_related
  on public.congregant_relations (synagogue_id, related_id);

alter table public.congregant_relations enable row level security;

comment on column public.congregants.gender is
  'גבר / אשה — לשם תפילה ולקישור משפחה';

comment on column public.congregants.father_died_gregorian_date is
  'פטירת האב — יארצייט וקדימות בעלייה';

comment on column public.congregants.mother_died_gregorian_date is
  'פטירת האם — יארצייט וקדימות בעלייה';

comment on table public.congregant_relations is
  'related הוא בן/בת/בעל/אשה של congregant';
