-- Per-synagogue halacha settings: start date, source, and display mode.
create table if not exists public.synagogue_halacha_settings (
  synagogue_id text primary key references public.synagogues(id) on delete cascade,
  start_date date not null default current_date,
  source_key text not null default 'kitzur_shulchan_arukh',
  display_mode text not null default 'summary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.synagogue_halacha_settings
drop constraint if exists synagogue_halacha_settings_display_mode_check;

alter table public.synagogue_halacha_settings
add constraint synagogue_halacha_settings_display_mode_check
check (display_mode in ('summary', 'full'));

insert into public.synagogue_halacha_settings (synagogue_id)
select s.id
from public.synagogues s
on conflict (synagogue_id) do nothing;

drop trigger if exists trg_synagogue_halacha_settings_updated_at on public.synagogue_halacha_settings;
create trigger trg_synagogue_halacha_settings_updated_at
before update on public.synagogue_halacha_settings
for each row execute function public.set_updated_at();
