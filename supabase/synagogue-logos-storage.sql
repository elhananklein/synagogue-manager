-- דלי ללוגו בתי הכנסת. השרת יוצר אותו גם לבד אם יש הרשאה;
-- אם ההעלאה נכשלת ב-Vercel, הריצו את זה ב-Supabase.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'synagogue-logos',
  'synagogue-logos',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream']
)
on conflict (id) do nothing;
