-- نفّذ هذا الملف في Supabase -> SQL Editor لو عندك مشروع قائم بالفعل
-- (لازم يتشغّل بعد 005_assistants.sql)

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

-- المدرس (owner) بس يقدر يستعرض السجل — المساعدين يقدروا يكتبوا (تسجيل نشاطهم)
-- لكن مايشوفوش سجل بعض أو سجل المدرس
create policy "owner read log" on activity_log for select
  using (teacher_id = effective_teacher_id() and is_owner());

create policy "team write log" on activity_log for insert
  with check (teacher_id = effective_teacher_id());
