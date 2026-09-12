-- نفّذ هذا الملف في Supabase -> SQL Editor لو عندك مشروع قائم بالفعل وفيه بيانات
-- (لازم يتشغّل بعد كل ملفات migrations السابقة: 002 و 003)
--
-- ⚠️ خطوة مهمة قبل التشغيل:
-- لازم تستبدل القيمة 'PASTE-YOUR-UID-HERE' في كل سطر تحت بالـ UID بتاعك انت
-- (صاحب البيانات الحالية كلها). تلاقيه في:
-- Supabase Dashboard -> Authentication -> Users -> انسخ عمود UID جنب إيميلك.

-- 1) إضافة عمود المالك (teacher_id) لكل جدول — بدون قيمة افتراضية أو NOT NULL مؤقتاً
alter table grades add column if not exists teacher_id uuid references auth.users(id) on delete cascade;
alter table groups_table add column if not exists teacher_id uuid references auth.users(id) on delete cascade;
alter table students add column if not exists teacher_id uuid references auth.users(id) on delete cascade;
alter table payments add column if not exists teacher_id uuid references auth.users(id) on delete cascade;
alter table attendance add column if not exists teacher_id uuid references auth.users(id) on delete cascade;
alter table payment_transactions add column if not exists teacher_id uuid references auth.users(id) on delete cascade;

-- 2) تعبئة كل البيانات الموجودة حالياً بحساب المعلّم الأصلي (انت)
update grades set teacher_id = 'PASTE-YOUR-UID-HERE' where teacher_id is null;
update groups_table set teacher_id = 'PASTE-YOUR-UID-HERE' where teacher_id is null;
update students set teacher_id = 'PASTE-YOUR-UID-HERE' where teacher_id is null;
update payments set teacher_id = 'PASTE-YOUR-UID-HERE' where teacher_id is null;
update attendance set teacher_id = 'PASTE-YOUR-UID-HERE' where teacher_id is null;
update payment_transactions set teacher_id = 'PASTE-YOUR-UID-HERE' where teacher_id is null;

-- 3) بعد التعبئة، خلي العمود إجباري وله قيمة افتراضية تلقائية (المستخدم المسجّل دخوله وقت الإضافة)
alter table grades alter column teacher_id set not null;
alter table grades alter column teacher_id set default auth.uid();

alter table groups_table alter column teacher_id set not null;
alter table groups_table alter column teacher_id set default auth.uid();

alter table students alter column teacher_id set not null;
alter table students alter column teacher_id set default auth.uid();

alter table payments alter column teacher_id set not null;
alter table payments alter column teacher_id set default auth.uid();

alter table attendance alter column teacher_id set not null;
alter table attendance alter column teacher_id set default auth.uid();

alter table payment_transactions alter column teacher_id set not null;
alter table payment_transactions alter column teacher_id set default auth.uid();

-- 4) فهارس للأداء
create index if not exists idx_grades_teacher on grades (teacher_id);
create index if not exists idx_groups_teacher on groups_table (teacher_id);
create index if not exists idx_students_teacher on students (teacher_id);
create index if not exists idx_payments_teacher on payments (teacher_id);
create index if not exists idx_attendance_teacher on attendance (teacher_id);
create index if not exists idx_txn_teacher on payment_transactions (teacher_id);

-- 5) شيل السياسة القديمة (أي مستخدم مسجّل دخول يشوف كل حاجة) وحطّ سياسة معزولة بدلها
drop policy if exists "authenticated full access" on grades;
drop policy if exists "authenticated full access" on groups_table;
drop policy if exists "authenticated full access" on students;
drop policy if exists "authenticated full access" on payments;
drop policy if exists "authenticated full access" on attendance;
drop policy if exists "authenticated full access" on payment_transactions;

create policy "owner full access" on grades
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

create policy "owner full access" on groups_table
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

create policy "owner full access" on students
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

create policy "owner full access" on payments
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

create policy "owner full access" on attendance
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

create policy "owner full access" on payment_transactions
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
