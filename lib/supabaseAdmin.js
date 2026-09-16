import { createClient } from '@supabase/supabase-js';

// ⚠️ الملف ده يشتغل على السيرفر بس (جوه app/api/.../route.js).
// SUPABASE_SERVICE_ROLE_KEY مفتاح إداري كامل الصلاحيات ومتجاوز لكل حماية RLS —
// لازم يتسجّل في Vercel كمتغيّر بيئة عادي (من غير بادئة NEXT_PUBLIC_) عشان
// يفضل سري على السيرفر ومايتحطش أبداً في كود المتصفح.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY غير مضبوط على السيرفر');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
