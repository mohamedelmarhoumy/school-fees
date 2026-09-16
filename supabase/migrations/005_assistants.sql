-- نفّذ هذا الملف في Supabase -> SQL Editor لو عندك مشروع قائم بالفعل
-- (لازم يتشغّل بعد كل ملفات migrations السابقة: 002 و 003 و 004)

-- ============================================================
-- 1) جدول الملفات الشخصية (profiles) — يحدد دور كل مستخدم وصلاحياته
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- لصاحب الحساب (owner): owner_id = id نفسه. للمساعد: owner_id = معرّف المدرس التابع له
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'assistant')),
  email text,
  display_name text,
  can_attendance boolean not null default true,
  can_payments boolean not null default true,
  can_students boolean not null default true,
  can_view_financials boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_owner on profiles (owner_id);

-- ============================================================
-- 2) دوال مساعدة (SECURITY DEFINER عشان تتفادى مشاكل الاستدعاء الذاتي في RLS)
-- ============================================================
create or replace function effective_teacher_id() returns uuid
language sql stable security definer set search_path = public as $$
  select owner_id from profiles where id = auth.uid() and is_active;
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'owner' and is_active from profiles where id = auth.uid()), false);
$$;

create or replace function has_perm(perm_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select
       case perm_name
         when 'attendance' then can_attendance
         when 'payments' then can_payments
         when 'students' then can_students
         when 'financials' then can_view_financials
         else false
       end
     from profiles where id = auth.uid() and is_active),
    false
  );
$$;

-- ============================================================
-- 3) إنشاء ملف تعريف تلقائي لأي حساب مدرّس جديد (owner) وقت إنشائه
-- ============================================================
create or replace function handle_new_owner_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, owner_id, role, email, display_name)
  values (new.id, new.id, 'owner', new.email, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_owner_profile();

-- تعبئة أي حساب موجود بالفعل قبل التحديث ده (المدرسين الحاليين) كـ owner
insert into profiles (id, owner_id, role, email, display_name)
select id, id, 'owner', email, email from auth.users
on conflict (id) do nothing;

-- ============================================================
-- 4) حماية جدول profiles نفسه
-- ============================================================
alter table profiles enable row level security;

drop policy if exists "select own profile" on profiles;
create policy "select own profile" on profiles for select
  using (id = auth.uid());

drop policy if exists "owner manage team" on profiles;
create policy "owner manage team" on profiles for all
  using (owner_id = auth.uid() and is_owner())
  with check (owner_id = auth.uid() and is_owner());

-- ============================================================
-- 5) تحديث سياسات كل جدول بيانات: قراءة لأي عضو فريق نشط،
--    وكتابة حسب الصلاحية المحددة (أو owner دايماً مسموح)
-- ============================================================

-- الصفوف والمجموعات: owner بس يقدر يعدّل (بيانات هيكلية للمدرسة)، والكل يقرأ
drop policy if exists "owner full access" on grades;
create policy "team read" on grades for select using (teacher_id = effective_teacher_id());
create policy "owner write" on grades for insert with check (teacher_id = effective_teacher_id() and is_owner());
create policy "owner update" on grades for update using (teacher_id = effective_teacher_id() and is_owner()) with check (teacher_id = effective_teacher_id() and is_owner());
create policy "owner delete" on grades for delete using (teacher_id = effective_teacher_id() and is_owner());

drop policy if exists "owner full access" on groups_table;
create policy "team read" on groups_table for select using (teacher_id = effective_teacher_id());
create policy "owner write" on groups_table for insert with check (teacher_id = effective_teacher_id() and is_owner());
create policy "owner update" on groups_table for update using (teacher_id = effective_teacher_id() and is_owner()) with check (teacher_id = effective_teacher_id() and is_owner());
create policy "owner delete" on groups_table for delete using (teacher_id = effective_teacher_id() and is_owner());

-- الطلاب: الكل يقرأ (محتاجينه للحضور/التحصيل)، والكتابة تحتاج صلاحية can_students أو owner
drop policy if exists "owner full access" on students;
create policy "team read" on students for select using (teacher_id = effective_teacher_id());
create policy "students write" on students for insert with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('students')));
create policy "students update" on students for update using (teacher_id = effective_teacher_id()) with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('students')));
create policy "students delete" on students for delete using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('students')));

-- الاشتراكات: القراءة والكتابة تحتاج صلاحية can_payments أو owner
-- (ملحوظة: صلاحية can_payments لازم تشوف مبلغ الطالب المستحق عشان تقدر تحصّله —
--  can_view_financials منفصلة وبتتحكم في الإجماليات/التقارير على مستوى الواجهة فقط)
drop policy if exists "owner full access" on payments;
create policy "payments read" on payments for select using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('payments')));
create policy "payments write" on payments for insert with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('payments')));
create policy "payments update" on payments for update using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('payments'))) with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('payments')));
create policy "payments delete" on payments for delete using (teacher_id = effective_teacher_id() and is_owner());

-- سجل التحصيل اليومي: الكتابة تلقائية عند تسجيل دفعة (تحتاج can_payments)،
-- لكن القراءة (استعراض سجل الخزينة كتقرير) تحتاج can_view_financials تحديداً
drop policy if exists "owner full access" on payment_transactions;
create policy "txn read" on payment_transactions for select using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('financials')));
create policy "txn write" on payment_transactions for insert with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('payments')));

-- الحضور: القراءة والكتابة تحتاج صلاحية can_attendance أو owner
drop policy if exists "owner full access" on attendance;
create policy "attendance read" on attendance for select using (teacher_id = effective_teacher_id());
create policy "attendance write" on attendance for insert with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('attendance')));
create policy "attendance update" on attendance for update using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('attendance'))) with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('attendance')));
create policy "attendance delete" on attendance for delete using (teacher_id = effective_teacher_id() and is_owner());

-- ============================================================
-- 6) تصحيح مهم: لازم عمود teacher_id ياخد قيمته من effective_teacher_id()
--    مش auth.uid() مباشرة — وإلا لو مساعد أضاف طالب، هيتسجل الطالب
--    وكأنه "معلّم" جديد مستقل بدل ما يتسجل تحت المدرس الأصلي بتاعه
-- ============================================================
alter table grades alter column teacher_id set default effective_teacher_id();
alter table groups_table alter column teacher_id set default effective_teacher_id();
alter table students alter column teacher_id set default effective_teacher_id();
alter table payments alter column teacher_id set default effective_teacher_id();
alter table attendance alter column teacher_id set default effective_teacher_id();
alter table payment_transactions alter column teacher_id set default effective_teacher_id();
