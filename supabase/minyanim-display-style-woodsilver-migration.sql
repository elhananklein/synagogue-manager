-- Allow the new woodSilver display style in existing databases.
alter table public.minyanim
drop constraint if exists minyanim_display_style_check;

alter table public.minyanim
add constraint minyanim_display_style_check
check (display_style in ('classic', 'modern', 'minimal', 'woodSilver'));
