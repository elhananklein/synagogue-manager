-- Allow "מידע מרכזי" rotator screen (centered, enlarged copy of the main screen's right-side content).
alter table public.minyan_display_screens
  drop constraint if exists minyan_display_screens_screen_key_check;

alter table public.minyan_display_screens
  add constraint minyan_display_screens_screen_key_check
  check (screen_key in ('main', 'mainInfo', 'clock', 'halacha', 'dailyLearning', 'prayerTimes'));
