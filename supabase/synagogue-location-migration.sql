-- מיקום ומנהג פר-בית-כנסת: זמני היום, כניסת/יציאת שבת יחושבו לפי הנקודה בפועל
-- (במקום ירושלים הקבועה). בתי כנסת ללא מיקום ימשיכו לקבל ברירת מחדל של ירושלים בקוד.

alter table public.synagogues
  add column if not exists locality text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists elevation integer,
  add column if not exists timezone text not null default 'Asia/Jerusalem',
  -- מנהג שבת:
  add column if not exists candle_lighting_minutes integer not null default 40,
  add column if not exists havdalah_mode text not null default 'tzeit'
    check (havdalah_mode in ('tzeit', 'minutes')),
  add column if not exists havdalah_minutes integer not null default 72;

-- ולידציה בסיסית לטווחי קואורדינטות (כשקיים ערך)
alter table public.synagogues
  drop constraint if exists synagogues_latitude_range;
alter table public.synagogues
  add constraint synagogues_latitude_range
  check (latitude is null or (latitude >= -90 and latitude <= 90));

alter table public.synagogues
  drop constraint if exists synagogues_longitude_range;
alter table public.synagogues
  add constraint synagogues_longitude_range
  check (longitude is null or (longitude >= -180 and longitude <= 180));

alter table public.synagogues
  drop constraint if exists synagogues_candle_minutes_range;
alter table public.synagogues
  add constraint synagogues_candle_minutes_range
  check (candle_lighting_minutes >= 0 and candle_lighting_minutes <= 120);

alter table public.synagogues
  drop constraint if exists synagogues_havdalah_minutes_range;
alter table public.synagogues
  add constraint synagogues_havdalah_minutes_range
  check (havdalah_minutes >= 0 and havdalah_minutes <= 120);
