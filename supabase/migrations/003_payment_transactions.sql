-- نفّذ هذا الملف في Supabase -> SQL Editor لو كان عندك مشروع قائم بالفعل
-- (لازم يتشغّل بعد 002_group_schedule.sql)

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  payment_id uuid references payments(id) on delete set null,
  amount numeric not null,
  created_at timestamptz not null default now()
);

alter table payment_transactions enable row level security;

create policy "authenticated full access" on payment_transactions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
