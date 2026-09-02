-- לוגו בית הכנסת: משמש כאייקון האפליקציה בשולחן העבודה (ושימושים נוספים בהמשך).

alter table public.synagogues
  add column if not exists logo_url text,
  add column if not exists logo_updated_at timestamptz;
