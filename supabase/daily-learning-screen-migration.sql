-- Allow "לימוד יומי" rotator screen (Hebcal daily learning overview).
alter table public.minyan_display_screens
  drop constraint if exists minyan_display_screens_screen_key_check;

alter table public.minyan_display_screens
  add constraint minyan_display_screens_screen_key_check
  check (screen_key in ('main', 'clock', 'halacha', 'dailyLearning'));
