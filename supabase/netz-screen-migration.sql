-- מסך «לוח הנץ»: ספירה לאחור עד הנץ, ואז «הנץ היה לפני» לעשר דקות.
-- המסך לא נוסף אוטומטית למניינים קיימים — הגבאי מדליק אותו במראה המסך.

alter table public.minyan_display_screens
  drop constraint if exists minyan_display_screens_screen_key_check;

alter table public.minyan_display_screens
  add constraint minyan_display_screens_screen_key_check
  check (screen_key in (
    'main',
    'mainInfo',
    'clock',
    'omer',
    'fast',
    'halacha',
    'dailyLearning',
    'prayerTimes',
    'shabbat',
    'bulletin',
    'fullSchedule',
    'netz'
  ));
