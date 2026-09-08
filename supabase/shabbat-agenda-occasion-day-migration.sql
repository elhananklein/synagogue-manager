-- ימי שבתון בלוח שבת/חג (1–3). ערב היום הראשון אינו יום נפרד.

alter table public.minyan_shabbat_agenda_items
  add column if not exists occasion_day smallint not null default 1;

alter table public.minyan_shabbat_agenda_items
  drop constraint if exists minyan_shabbat_agenda_items_occasion_day_check;

alter table public.minyan_shabbat_agenda_items
  add constraint minyan_shabbat_agenda_items_occasion_day_check
  check (occasion_day in (1, 2, 3));

create index if not exists idx_minyan_shabbat_agenda_items_day
  on public.minyan_shabbat_agenda_items (minyan_id, occasion_day, sort_order);
