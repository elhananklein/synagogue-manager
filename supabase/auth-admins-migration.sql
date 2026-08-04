-- הזדהות והרשאות לממשק הניהול (אימייל+סיסמה דרך Supabase Auth)
-- שתי טבלאות: admin_users (תפקיד + דגל החלפת סיסמה) ו-synagogue_admins (איזה גבאי מנהל איזה בית כנסת)

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('system', 'gabbai')),
  display_name text,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.synagogue_admins (
  user_id uuid not null references auth.users(id) on delete cascade,
  synagogue_id text not null references public.synagogues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, synagogue_id)
);

create index if not exists idx_synagogue_admins_synagogue on public.synagogue_admins(synagogue_id);
create index if not exists idx_synagogue_admins_user on public.synagogue_admins(user_id);

drop trigger if exists trg_admin_users_updated_at on public.admin_users;
create trigger trg_admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

-- RLS: הכל נעול. השרת ניגש עם service role (עוקף RLS). משתמש מאומת רשאי לקרוא רק את השורה שלו.
alter table public.admin_users enable row level security;
alter table public.synagogue_admins enable row level security;

drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read on public.admin_users
  for select using (auth.uid() = user_id);

drop policy if exists synagogue_admins_self_read on public.synagogue_admins;
create policy synagogue_admins_self_read on public.synagogue_admins
  for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- אתחול מנהל-העל הראשון (פעם אחת):
-- 1) Supabase Dashboard → Authentication → Users → Add user
--    אימייל + סיסמה, וסמן "Auto Confirm User".
-- 2) הרץ את ה-INSERT למטה אחרי החלפת האימייל האמיתי שלך.
--    זה מגדיר תפקיד system ומבטל חובת החלפת סיסמה (למנהל אין סיסמה זמנית).
--
-- insert into public.admin_users (user_id, role, display_name, must_change_password)
-- select id, 'system', 'מנהל מערכת', false
-- from auth.users
-- where email = 'CHANGE_ME@example.com'
-- on conflict (user_id) do update set role = 'system', must_change_password = false;
--
-- איפוס עצמי ("שכחתי סיסמה"):
-- Authentication → URL Configuration → Redirect URLs:
--   http://localhost:3000/auth/callback
--   https://YOUR_DOMAIN/auth/callback
-- בפרוד מומלץ SMTP מותאם (Authentication → SMTP) כדי שמיילי האיפוס יגיעו.
-- ─────────────────────────────────────────────────────────────────────────────
