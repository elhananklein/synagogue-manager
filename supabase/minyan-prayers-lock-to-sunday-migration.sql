-- זמן מנחה/ערבית יחסית לזמן היום, קבוע לפי יום ראשון לכל השבוע.
alter table public.minyan_prayers
  add column if not exists lock_to_sunday boolean not null default false;

comment on column public.minyan_prayers.lock_to_sunday is
  'כש-mode = relative: לחשב לפי זמני יום ראשון ולהציג אותו זמן בכל ימות השבוע';
