-- אורחים לעלייה: כרטיס דל (שם + משפחה, טלפון לא חובה) בלי תאריך לידה.

alter table public.congregants
  add column if not exists is_guest boolean not null default false;

alter table public.congregants
  alter column gregorian_birth_date drop not null;

alter table public.congregants
  alter column hebrew_birth_year drop not null;

alter table public.congregants
  alter column hebrew_birth_month drop not null;

alter table public.congregants
  alter column hebrew_birth_day drop not null;

comment on column public.congregants.is_guest is
  'אורח לעלייה — פרטים דלים, לא נכנס לסבב ההמלצות האוטומטי';
