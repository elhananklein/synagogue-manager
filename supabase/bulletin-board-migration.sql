-- לוח מודעות — הודעות טקסט או תמונה לכל בית כנסת

create table if not exists public.synagogue_bulletin_items (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  kind text not null check (kind in ('text', 'image')),
  title text,
  body_text text,
  image_url text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_synagogue_bulletin_items_synagogue
  on public.synagogue_bulletin_items (synagogue_id, sort_order);

drop trigger if exists trg_synagogue_bulletin_items_updated_at on public.synagogue_bulletin_items;
create trigger trg_synagogue_bulletin_items_updated_at
before update on public.synagogue_bulletin_items
for each row execute function public.set_updated_at();

-- מסך «לוח מודעות» ברוטator
alter table public.minyan_display_screens
  drop constraint if exists minyan_display_screens_screen_key_check;

alter table public.minyan_display_screens
  add constraint minyan_display_screens_screen_key_check
  check (screen_key in ('main', 'mainInfo', 'clock', 'halacha', 'dailyLearning', 'prayerTimes', 'shabbat', 'bulletin'));
