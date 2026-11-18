-- האם להציג מחיר במסך «שיעורים» (לא בלוח הזמנים / קוביות).

alter table public.synagogues
  add column if not exists lessons_show_price boolean not null default false;

comment on column public.synagogues.lessons_show_price is
  'מסך שיעורים בלבד: true = להציג מחיר על מסגרת/שיעור; לוח זמנים מלא לעולם לא מציג מחיר';
