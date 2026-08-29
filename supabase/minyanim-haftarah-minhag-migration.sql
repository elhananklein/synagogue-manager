-- מנהג הפטרה פר-מניין: אשכנזי / ספרדי / חב״ד.

alter table public.minyanim
add column if not exists haftarah_minhag text;

alter table public.minyanim
drop constraint if exists minyanim_haftarah_minhag_check;

alter table public.minyanim
add constraint minyanim_haftarah_minhag_check
check (haftarah_minhag is null or haftarah_minhag in ('ashkenazi', 'sephardi', 'chabad'));
