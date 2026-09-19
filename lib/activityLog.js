import { supabase } from './supabaseClient';

/** يسجّل حدث في سجل النشاط. متعمّد إنه ميعطّلش العملية الأساسية لو السجل فشل. */
export async function logActivity(actorName, action, details) {
  try {
    await supabase.from('activity_log').insert({
      actor_name: actorName || 'غير معروف',
      action,
      details,
    });
  } catch (err) {
    // تجاهل أي خطأ في التسجيل نفسه
  }
}
