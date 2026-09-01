-- בחירת אילו ספרי לימוד יומי להציג במסך הלימוד היומי.
-- NULL = כל הספרים שבקטלוג. מערך (גם ריק) = בחירה מפורשת של הגבאי.
alter table public.minyanim
  add column if not exists daily_learning_keys text[];

comment on column public.minyanim.daily_learning_keys is
  'מפתחות ספרי לימוד יומי (Hebcal) להצגה במסך הלימוד היומי. NULL = כל הספרים.';
