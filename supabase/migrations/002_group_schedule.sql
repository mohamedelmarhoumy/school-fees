-- نفّذ هذا الملف في Supabase -> SQL Editor لو كنت بالفعل عملت الجداول من قبل
-- (لو لسه مبدأتش المشروع، يكفي تشغيل schema.sql الأساسي بدل هذا الملف)

alter table groups_table add column if not exists days_of_week smallint[] not null default '{}';
alter table groups_table add column if not exists start_time time;
alter table groups_table add column if not exists end_time time;
