-- نفّذ هذا الملف كامل في: Supabase Dashboard -> SQL Editor -> New query -> Run
-- (هذا الملف لمشروع Supabase جديد بالكامل. لو عندك بيانات موجودة بالفعل،
--  استخدم ملفات supabase/migrations بالترتيب الرقمي بدلاً منه)

create extension if not exists "pgcrypto";

-- ============================================================
-- 1) نظام الأدوار: owner (المدرس) و assistant (المساعد)
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
  subject_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_owner on profiles (owner_id);

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

-- ينشئ ملف تعريف "owner" تلقائياً لأي حساب مدرّس جديد وقت إنشائه من لوحة Supabase
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

-- ============================================================
-- 2) جداول التطبيق — teacher_id بياخد قيمته تلقائياً من effective_teacher_id()
--    (المدرس نفسه لو owner، أو المدرس التابع له لو assistant)
-- ============================================================
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default effective_teacher_id() references auth.users(id) on delete cascade,
  name text not null,
  monthly_fee numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists groups_table (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default effective_teacher_id() references auth.users(id) on delete cascade,
  grade_id uuid not null references grades(id) on delete cascade,
  name text not null,
  -- أيام الأسبوع كأرقام: 0=الأحد ... 6=السبت (نفس ترقيم JavaScript Date.getDay())
  days_of_week smallint[] not null default '{}',
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default effective_teacher_id() references auth.users(id) on delete cascade,
  name text not null,
  student_number text,
  parent_phone text,
  grade_id uuid references grades(id) on delete set null,
  group_id uuid references groups_table(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default effective_teacher_id() references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  year int not null,
  month int not null,
  amount_due numeric not null default 0,
  amount_paid numeric not null default 0,
  discount_amount numeric not null default 0,
  status text not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, year, month)
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default effective_teacher_id() references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  group_id uuid not null references groups_table(id) on delete cascade,
  date date not null,
  status text not null default 'present',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default effective_teacher_id() references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  payment_id uuid references payments(id) on delete set null,
  amount numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_students_group on students (group_id);
create index if not exists idx_payments_month on payments (year, month);
create index if not exists idx_attendance_group_date on attendance (group_id, date);
create index if not exists idx_attendance_student on attendance (student_id);
create index if not exists idx_grades_teacher on grades (teacher_id);
create index if not exists idx_groups_teacher on groups_table (teacher_id);
create index if not exists idx_students_teacher on students (teacher_id);
create index if not exists idx_payments_teacher on payments (teacher_id);
create index if not exists idx_attendance_teacher on attendance (teacher_id);
create index if not exists idx_txn_teacher on payment_transactions (teacher_id);

-- ============================================================
-- 3) الحماية (RLS) — profiles نفسه
-- ============================================================
alter table profiles enable row level security;

create policy "select own profile" on profiles for select
  using (id = auth.uid());

create policy "owner manage team" on profiles for all
  using (owner_id = auth.uid() and is_owner())
  with check (owner_id = auth.uid() and is_owner());

-- يسمح لأي عضو فريق (owner أو assistant) يقرا اسم واسم مادة المدرس التابع له
-- عشان يظهر في أعلى الشاشة
create policy "team read owner profile" on profiles for select
  using (id = effective_teacher_id());

-- ============================================================
-- 4) الحماية (RLS) — جداول البيانات، بحسب الدور والصلاحيات
-- ============================================================
alter table grades enable row level security;
alter table groups_table enable row level security;
alter table students enable row level security;
alter table payments enable row level security;
alter table attendance enable row level security;
alter table payment_transactions enable row level security;

-- الصفوف والمجموعات: owner بس يقدر يعدّل، والفريق كله يقرأ
create policy "team read" on grades for select using (teacher_id = effective_teacher_id());
create policy "owner write" on grades for insert with check (teacher_id = effective_teacher_id() and is_owner());
create policy "owner update" on grades for update using (teacher_id = effective_teacher_id() and is_owner()) with check (teacher_id = effective_teacher_id() and is_owner());
create policy "owner delete" on grades for delete using (teacher_id = effective_teacher_id() and is_owner());

create policy "team read" on groups_table for select using (teacher_id = effective_teacher_id());
create policy "owner write" on groups_table for insert with check (teacher_id = effective_teacher_id() and is_owner());
create policy "owner update" on groups_table for update using (teacher_id = effective_teacher_id() and is_owner()) with check (teacher_id = effective_teacher_id() and is_owner());
create policy "owner delete" on groups_table for delete using (teacher_id = effective_teacher_id() and is_owner());

-- الطلاب: الفريق كله يقرأ، والكتابة تحتاج صلاحية can_students أو owner
create policy "team read" on students for select using (teacher_id = effective_teacher_id());
create policy "students write" on students for insert with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('students')));
create policy "students update" on students for update using (teacher_id = effective_teacher_id()) with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('students')));
create policy "students delete" on students for delete using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('students')));

-- الاشتراكات: القراءة/الكتابة تحتاج صلاحية can_payments أو owner
create policy "payments read" on payments for select using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('payments')));
create policy "payments write" on payments for insert with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('payments')));
create policy "payments update" on payments for update using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('payments'))) with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('payments')));
create policy "payments delete" on payments for delete using (teacher_id = effective_teacher_id() and is_owner());

-- سجل التحصيل اليومي: الكتابة تلقائية مع can_payments، لكن قراءته كـ"تقرير" تحتاج can_view_financials
create policy "txn read" on payment_transactions for select using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('financials')));
create policy "txn write" on payment_transactions for insert with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('payments')));

-- الحضور: القراءة/الكتابة تحتاج صلاحية can_attendance أو owner
create policy "attendance read" on attendance for select using (teacher_id = effective_teacher_id());
create policy "attendance write" on attendance for insert with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('attendance')));
create policy "attendance update" on attendance for update using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('attendance'))) with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('attendance')));
create policy "attendance delete" on attendance for delete using (teacher_id = effective_teacher_id() and is_owner());

-- ============================================================
-- 6) المصروفات (Expenses) — وحدة صافي الأرباح
-- ============================================================
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

-- مقصورة على owner أو عضو فريق عنده صلاحية "التقارير المالية" تحديداً
create policy "financials manage expenses" on expenses for all
  using (teacher_id = effective_teacher_id() and (is_owner() or has_perm('financials')))
  with check (teacher_id = effective_teacher_id() and (is_owner() or has_perm('financials')));

-- ============================================================
-- 5) سجل النشاط — متابعة المدرس لأفعال المساعدين
-- ============================================================
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default effective_teacher_id() references auth.users(id) on delete cascade,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  actor_name text,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_teacher_created on activity_log (teacher_id, created_at desc);

alter table activity_log enable row level security;

create policy "owner read log" on activity_log for select
  using (teacher_id = effective_teacher_id() and is_owner());

create policy "team write log" on activity_log for insert
  with check (teacher_id = effective_teacher_id());
