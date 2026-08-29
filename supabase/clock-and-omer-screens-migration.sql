-- מסך שעון חדש (clock) + שינוי שם מסך ספירת העומר מ-clock ל-omer

alter table public.minyan_display_screens
  drop constraint if exists minyan_display_screens_screen_key_check;

update public.minyan_display_screens
set screen_key = 'omer'
where screen_key = 'clock';

insert into public.minyan_display_screens (minyan_id, screen_key, sort_order, duration_seconds, enabled)
select
  m.id,
  'clock',
  coalesce(x.max_sort, 0) + 1,
  15,
  true
from public.minyanim m
left join (
  select minyan_id, max(sort_order) as max_sort
  from public.minyan_display_screens
  group by minyan_id
) x on x.minyan_id = m.id
where not exists (
  select 1
  from public.minyan_display_screens s
  where s.minyan_id = m.id
    and s.screen_key = 'clock'
);

alter table public.minyan_display_screens
  add constraint minyan_display_screens_screen_key_check
  check (screen_key in (
    'main',
    'mainInfo',
    'clock',
    'omer',
    'halacha',
    'dailyLearning',
    'prayerTimes',
    'shabbat',
    'bulletin',
    'fullSchedule'
  ));
