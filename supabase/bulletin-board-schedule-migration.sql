-- תאריכי הצגה ללוח מודעות: מ- / עד- (כולל). לאחר עבר תאריך הסיום — ההודעה נמחקת.

alter table public.synagogue_bulletin_items
  add column if not exists display_from date not null default current_date,
  add column if not exists display_until date not null default (current_date + interval '30 days');

create index if not exists idx_synagogue_bulletin_items_schedule
  on public.synagogue_bulletin_items (synagogue_id, display_from, display_until);
