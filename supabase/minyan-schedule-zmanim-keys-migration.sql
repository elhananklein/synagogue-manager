-- בחירת אילו זמני יום (זמנים הלכתיים) להציג בלוח "זמני היום ותפילות" במסך הראשי.
-- NULL = ברירת המחדל של המערכת (7 הזמנים ההיסטוריים). מערך ריק אינו נשמר (יטופל כברירת מחדל).
alter table public.minyanim
  add column if not exists schedule_zmanim_keys text[];

comment on column public.minyanim.schedule_zmanim_keys is
  'מפתחות זמנים הלכתיים (Hebcal) להצגה בלוח המסך הראשי. NULL = ברירת מחדל.';
