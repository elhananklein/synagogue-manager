-- Expand daily_halacha for Kitzur Shulchan Arukh ingestion.
alter table public.daily_halacha
add column if not exists full_text text;

alter table public.daily_halacha
add column if not exists summary_text text;

alter table public.daily_halacha
add column if not exists book_name text;

alter table public.daily_halacha
add column if not exists chapter_number integer;

alter table public.daily_halacha
add column if not exists section_number integer;

alter table public.daily_halacha
add column if not exists topic text;

alter table public.daily_halacha
add column if not exists source_key text not null default 'manual';

alter table public.daily_halacha
add column if not exists display_day integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by coalesce(source_key, 'manual')
      order by chapter_number nulls last, section_number nulls last, halacha_date nulls last, created_at
    ) as rn
  from public.daily_halacha
)
update public.daily_halacha d
set display_day = r.rn
from ranked r
where d.id = r.id
  and d.display_day is null;

alter table public.daily_halacha
alter column display_day set not null;

alter table public.daily_halacha
drop constraint if exists daily_halacha_halacha_date_key;

alter table public.daily_halacha
drop constraint if exists daily_halacha_source_key_display_day_key;

alter table public.daily_halacha
add constraint daily_halacha_source_key_display_day_key unique (source_key, display_day);

-- Backfill new text columns from existing content.
update public.daily_halacha
set
  summary_text = coalesce(summary_text, content),
  full_text = coalesce(full_text, content),
  source_key = case
    when coalesce(book_name, '') = 'קיצור שולחן ערוך' then 'kitzur_shulchan_arukh'
    else coalesce(source_key, 'manual')
  end;
