-- نفّذ هذا الملف في Supabase -> SQL Editor لو عندك مشروع قائم بالفعل
-- (لازم يتشغّل بعد 006_activity_log.sql)

alter table profiles add column if not exists subject_name text;

-- يسمح لأي عضو فريق (owner أو assistant) يقرا اسم واسم مادة "المدرس" اللي تابع له
-- (نفس صف الـ owner) عشان يظهر في أعلى الشاشة، حتى لو هو نفسه مساعد
drop policy if exists "team read owner profile" on profiles;
create policy "team read owner profile" on profiles for select
  using (id = effective_teacher_id());
