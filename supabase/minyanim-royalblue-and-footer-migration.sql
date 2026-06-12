-- Add the new "royalBlue" display style and a free-text footer for displays.

-- 1) Allow the royalBlue display style.
alter table public.minyanim
drop constraint if exists minyanim_display_style_check;

alter table public.minyanim
add constraint minyanim_display_style_check
check (display_style in ('classic', 'modern', 'minimal', 'woodSilver', 'royalBlue'));

-- 2) Free-text footer shown at the bottom of the display (currently rendered in royalBlue).
alter table public.minyanim
add column if not exists display_footer_text text;
