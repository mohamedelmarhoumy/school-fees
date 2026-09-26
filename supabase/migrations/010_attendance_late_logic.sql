-- نفّذ هذا الملف في Supabase -> SQL Editor
-- يضيف: مدة سماح تأخير قابلة للتخصيص لكل مجموعة، ووقت مسح الباركود الفعلي لكل طالب،
-- ويغيّر الحالة الافتراضية للحضور إلى "غائب" بدل "حاضر".

-- مدة سماح التأخير بالدقائق — قابلة للتعديل لكل مجموعة على حدة (افتراضياً 15 دقيقة)
alter table groups_table add column if not exists grace_period_minutes int not null default 15;

-- وقت مسح الباركود الفعلي لكل طالب (لتسهيل المراجعة والتقارير)
alter table attendance add column if not exists scanned_at timestamptz;

-- الحالة الافتراضية بقت "غائب": أي طالب ما اتمسحش له باركود يفضل غائب لحد ما يتسجّل
alter table attendance alter column status set default 'absent';
