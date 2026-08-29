-- סגנון «בולט מאוד» + פלטת צבעים נפרדת מהפריסה (כרגע בשימוש בסגנון הזה בלבד).

alter table public.minyanim
drop constraint if exists minyanim_display_style_check;

alter table public.minyanim
add constraint minyanim_display_style_check
check (display_style in ('classic', 'modern', 'minimal', 'woodSilver', 'royalBlue', 'veryBold'));

alter table public.minyanim
add column if not exists display_palette text;

alter table public.minyanim
drop constraint if exists minyanim_display_palette_check;

alter table public.minyanim
add constraint minyanim_display_palette_check
check (display_palette is null or display_palette in ('inkIvory', 'azureGold'));
