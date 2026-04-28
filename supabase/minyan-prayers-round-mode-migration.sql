-- Add 5-minute rounding mode for relative prayer times.
alter table public.minyan_prayers
add column if not exists round_mode text not null default 'none';

alter table public.minyan_prayers
drop constraint if exists minyan_prayers_round_mode_check;

alter table public.minyan_prayers
add constraint minyan_prayers_round_mode_check
check (round_mode in ('none', 'up', 'down'));
