-- זמני תפילה "לפי פרשה" (ימי א׳–ה׳ בלבד במסך; שבת ללא שינוי)
alter table public.minyan_prayers drop constraint if exists minyan_prayers_mode_check;
alter table public.minyan_prayers
  add constraint minyan_prayers_mode_check check (mode in ('fixed', 'relative', 'parasha'));

alter table public.minyan_prayers add column if not exists parasha_key text;

comment on column public.minyan_prayers.parasha_key is 'מפתח פרשה כפי שמוחזר מ־Hebcal (עברית), רלוונטי כש־mode = parasha';
