-- Remove legacy date-based scheduling column from daily_halacha.
alter table public.daily_halacha
drop constraint if exists daily_halacha_halacha_date_key;

alter table public.daily_halacha
drop column if exists halacha_date;
