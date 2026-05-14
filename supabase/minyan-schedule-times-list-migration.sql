-- מה להציג בלוח "זמני היום ותפילות" במסך הראשי: כולל זמני היום (זמנים הלכתיים) או רק תפילות
alter table public.minyanim add column if not exists schedule_times_list text not null default 'all';

alter table public.minyanim drop constraint if exists minyanim_schedule_times_list_check;

alter table public.minyanim
  add constraint minyanim_schedule_times_list_check check (schedule_times_list in ('all', 'prayers_only'));

comment on column public.minyanim.schedule_times_list is 'all = זמני היום + תפילות; prayers_only = רק תפילות בלוח המסך';
