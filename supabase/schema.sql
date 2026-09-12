-- نفّذ هذا الملف كامل في: Supabase Dashboard -> SQL Editor -> New query -> Run
-- (هذا الملف لمشروع Supabase جديد بالكامل. لو عندك بيانات موجودة بالفعل،
--  استخدم migrations/004_multi_teacher.sql بدلاً منه)

create extension if not exists "pgcrypto";

create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  -- صاحب البيانات: المدرس المسجّل دخوله وقت الإنشاء (يُملأ تلقائياً، لا يُرسَل من التطبيق)
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  monthly_fee numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists groups_table (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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

-- تأمين البيانات: كل مدرس يشوف ويعدّل بياناته هو بس (معزول 100% عن باقي المدرسين)
alter table grades enable row level security;
alter table groups_table enable row level security;
alter table students enable row level security;
alter table payments enable row level security;
alter table attendance enable row level security;
alter table payment_transactions enable row level security;

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
