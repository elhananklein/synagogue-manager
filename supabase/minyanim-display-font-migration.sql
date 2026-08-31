-- פונט תצוגה לבחירת הגבאי (קיר + מובייל). ברירת מחדל: Heebo.

alter table public.minyanim
add column if not exists display_font text;

alter table public.minyanim
drop constraint if exists minyanim_display_font_check;

alter table public.minyanim
add constraint minyanim_display_font_check
check (display_font is null or display_font in ('heebo', 'bonaNova', 'david', 'arial'));
