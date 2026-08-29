-- פלטה נוספת ל«בולט מאוד»: בורדו קלאסי (צבעי classic, בלי לשנות את סגנון classic).

alter table public.minyanim
drop constraint if exists minyanim_display_palette_check;

alter table public.minyanim
add constraint minyanim_display_palette_check
check (display_palette is null or display_palette in ('inkIvory', 'azureGold', 'classicBurgundy'));
