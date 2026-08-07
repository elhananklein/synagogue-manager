-- העברת לוח זמנים לשבת מבית הכנסת → למניין
-- כולל העתקת נתונים שכבר הוזנו ב־synagogue_shabbat_agenda_items לכל המניינים של אותו בית כנסת.

create table if not exists public.minyan_shabbat_agenda_items (
  id uuid primary key default gen_random_uuid(),
  minyan_id uuid not null references public.minyanim(id) on delete cascade,
  sort_order integer not null default 0,
  item_time text,
  content text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint minyan_shabbat_agenda_items_time_format
    check (item_time is null or item_time ~ '^\d{2}:\d{2}$')
);

create index if not exists idx_minyan_shabbat_agenda_items_minyan
  on public.minyan_shabbat_agenda_items (minyan_id, sort_order);

drop trigger if exists trg_minyan_shabbat_agenda_items_updated_at on public.minyan_shabbat_agenda_items;
create trigger trg_minyan_shabbat_agenda_items_updated_at
before update on public.minyan_shabbat_agenda_items
for each row execute function public.set_updated_at();

-- העתקה: כל שורה ברמת בית הכנסת → עותק לכל מניין של אותו בית כנסת
-- (רק אם טבלת המקור קיימת; לא דורסים מניינים שכבר יש להם לוח)
do $$
begin
  if to_regclass('public.synagogue_shabbat_agenda_items') is null then
    raise notice 'synagogue_shabbat_agenda_items לא קיימת — דילוג על העתקה';
    return;
  end if;

  insert into public.minyan_shabbat_agenda_items (
    minyan_id,
    sort_order,
    item_time,
    content,
    published
  )
  select
    m.id,
    a.sort_order,
    a.item_time,
    a.content,
    a.published
  from public.synagogue_shabbat_agenda_items a
  inner join public.minyanim m on m.synagogue_id = a.synagogue_id
  where not exists (
    select 1
    from public.minyan_shabbat_agenda_items existing
    where existing.minyan_id = m.id
  );

  raise notice 'הועתקו שורות לוח שבת מבית הכנסת למניינים (רק למניינים ללא לוח קיים)';
end $$;

-- לאחר ההעתקה — מסירים את הטבלה הישנה ברמת בית הכנסת
drop table if exists public.synagogue_shabbat_agenda_items;
