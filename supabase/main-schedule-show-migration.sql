-- מסך ראשי: מה להציג ברשימת הזמנים (תפילות / שיעורים).
-- זמני היום נשארים ב־schedule_times_list (all / prayers_only).

alter table public.minyanim
  add column if not exists schedule_show_prayers boolean not null default true;

alter table public.minyanim
  add column if not exists schedule_show_lessons boolean not null default false;

comment on column public.minyanim.schedule_show_prayers is
  'מסך ראשי: להציג תפילות ברשימת הזמנים';

comment on column public.minyanim.schedule_show_lessons is
  'מסך ראשי: להציג שיעורים ברשימת הזמנים (בלי מחיר)';
