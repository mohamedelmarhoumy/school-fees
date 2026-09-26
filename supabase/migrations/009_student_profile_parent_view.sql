-- الميزة: الملف الإلكتروني الشامل للطالب + صفحة متابعة عامة لولي الأمر
-- شغّل هذا الملف في Supabase Dashboard -> SQL Editor لو مشروعك موجود بالفعل

-- ============================================================
-- 1) درجات الكويزات والواجبات لكل طالب
-- ============================================================
create table if not exists student_scores (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default effective_teacher_id() references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  quiz_date date not null default current_date,
  lesson_name text not null,
  score numeric not null default 0,
  max_score numeric not null default 10,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scores_student on student_scores (student_id, quiz_date desc);
create index if not exists idx_scores_teacher on student_scores (teacher_id);

alter table student_scores enable row level security;

-- نفس منطق صلاحية "الطلاب" (can_students) المستخدمة أصلاً لإدارة بيانات الطالب
create policy "team read" on student_scores for select using (teacher_id = effective_teacher_id());
create policy "scores write" on student_scores for insert with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('students')));
create policy "scores update" on student_scores for update using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('students'))) with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('students')));
create policy "scores delete" on student_scores for delete using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('students')));

-- ============================================================
-- 2) رابط متابعة آمن لولي الأمر (بدون تسجيل دخول) + اسمه (اختياري لتخصيص الرسالة)
-- ============================================================
alter table students add column if not exists parent_token uuid not null default gen_random_uuid();
alter table students add column if not exists parent_name text;

create unique index if not exists idx_students_parent_token on students (parent_token);

-- ملاحظة أمان: الجدول محمي بـ RLS زي ما هو، فمفيش قراءة عامة مباشرة للجدول.
-- صفحة ولي الأمر (/p/[token]) بتعدّي من مسار API على السيرفر بيستخدم مفتاح
-- service_role (يتخطى RLS عمداً) ويقرا صف الطالب بمطابقة parent_token بالظبط فقط —
-- من غير ما يكشف أي بيانات عن باقي الطلاب أو المدرس.
