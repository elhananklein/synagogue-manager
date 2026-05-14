-- UI used מוצ"ש (U+0022); DB constraint expects מוצ'ש (ASCII apostrophe). Fix any bad rows.
update public.minyan_prayers
set prayer_type = 'ערבית מוצ''ש'
where prayer_type in ('ערבית מוצ"ש', 'ערבית מוצ״ש');
