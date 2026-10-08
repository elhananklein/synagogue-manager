-- בחירה נפרדת של זמני היום למסך «לוח זמנים מלא», לכל מניין.
-- NULL = כמו במסך הראשי (schedule_zmanim_keys). מערך ריק = רק תפילות.

alter table public.minyanim
  add column if not exists full_schedule_zmanim_keys text[];

comment on column public.minyanim.full_schedule_zmanim_keys is
  'זמני היום למסך «לוח זמנים מלא». NULL = כמו במסך הראשי; מערך ריק = רק תפילות';
