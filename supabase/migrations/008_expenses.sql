-- نفّذ هذا الملف في Supabase -> SQL Editor
-- (لازم يتشغّل بعد 007_teacher_profile.sql)

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default effective_teacher_id() references auth.users(id) on delete cascade,
  title text not null,
  amount numeric not null default 0,
  expense_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_teacher_date on expenses (teacher_id, expense_date);

alter table expenses enable row level security;

-- وحدة المصروفات كلها (عرض وإضافة وتعديل وحذف) مقصورة على owner أو أي عضو
-- فريق عنده صلاحية "الاطّلاع على التقارير المالية" تحديداً
create policy "financials manage expenses" on expenses for all
  using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('financials')))
  with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('financials')));
