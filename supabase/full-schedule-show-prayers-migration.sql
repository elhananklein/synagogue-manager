-- האם מסך «לוח זמנים מלא» מציג גם תפילות, או רק את זמני היום. לכל מניין.

alter table public.minyanim
  add column if not exists full_schedule_show_prayers boolean not null default true;

comment on column public.minyanim.full_schedule_show_prayers is
  'מסך «לוח זמנים מלא»: true = תפילות וזמנים; false = רק זמני היום';
