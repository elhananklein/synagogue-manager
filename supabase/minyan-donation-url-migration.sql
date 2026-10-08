-- קישור לתרומה לכל מניין בנפרד. ריק = משתמשים בקישור הכללי של בית הכנסת (synagogues.donation_url).

alter table public.minyanim
  add column if not exists donation_url text;

comment on column public.minyanim.donation_url is
  'קישור לתרומה של המניין. גובר על synagogues.donation_url בהודעות לעולים. ריק = הקישור של בית הכנסת';
