-- לוח זמנים / סדר יום לשבת — גרסה ראשונה (ברמת בית כנסת).
-- הוחלף ב־shabbat-agenda-minyan-migration.sql (ברמת מניין + העתקת נתונים).
-- אין צורך להריץ קובץ זה בסביבות חדשות אם מריצים ישירות את מיגרציית המניין.

create table if not exists public.synagogue_shabbat_agenda_items (
  id uuid primary key default gen_random_uuid(),
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  sort_order integer not null default 0,
  -- שעה אופציונלית בפורמט HH:MM; null = שורה ללא שעה
  item_time text,
  content text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint synagogue_shabbat_agenda_items_time_format
    check (item_time is null or item_time ~ '^\d{2}:\d{2}$')
);

create index if not exists idx_synagogue_shabbat_agenda_items_synagogue
  on public.synagogue_shabbat_agenda_items (synagogue_id, sort_order);

drop trigger if exists trg_synagogue_shabbat_agenda_items_updated_at on public.synagogue_shabbat_agenda_items;
create trigger trg_synagogue_shabbat_agenda_items_updated_at
before update on public.synagogue_shabbat_agenda_items
for each row execute function public.set_updated_at();
