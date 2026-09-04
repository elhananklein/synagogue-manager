-- סטטוס הרשמה עצמית: pending עד שהגבאי מאשר. גבאי/אקסל נשארים approved.

alter table public.congregants
  add column if not exists registration_status text;

update public.congregants
set registration_status = 'approved'
where registration_status is null;

alter table public.congregants
  alter column registration_status set default 'approved';

alter table public.congregants
  alter column registration_status set not null;

alter table public.congregants
  drop constraint if exists congregants_registration_status_check;

alter table public.congregants
  add constraint congregants_registration_status_check
  check (registration_status in ('pending', 'approved'));

create index if not exists idx_congregants_pending
  on public.congregants (synagogue_id, created_at desc)
  where registration_status = 'pending';

comment on column public.congregants.registration_status is
  'pending = נרשם לבד ומחכה לאישור הגבאי. approved = רשום.';
