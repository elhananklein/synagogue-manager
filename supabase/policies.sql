-- Public read access for published content (homepage)
-- If you already manage RLS differently, adjust accordingly.

alter table public.prayer_schedules enable row level security;
alter table public.daily_halacha enable row level security;

drop policy if exists "public_read_published_prayer_schedules" on public.prayer_schedules;
create policy "public_read_published_prayer_schedules"
on public.prayer_schedules
for select
to anon
using (published = true);

drop policy if exists "public_read_published_daily_halacha" on public.daily_halacha;
create policy "public_read_published_daily_halacha"
on public.daily_halacha
for select
to anon
using (published = true);

