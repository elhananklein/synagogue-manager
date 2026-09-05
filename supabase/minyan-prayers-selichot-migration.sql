-- סליחות כסוג תפילה בימי חול (לפני שחרית).

alter table public.minyan_prayers
drop constraint if exists minyan_prayers_prayer_type_check;

alter table public.minyan_prayers
add constraint minyan_prayers_prayer_type_check
check (prayer_type in (
  'סליחות',
  'שחרית',
  'מנחה',
  'ערבית',
  'מנחה ערב שבת',
  'שחרית שבת',
  'מנחה שבת',
  'ערבית מוצ''ש'
));
