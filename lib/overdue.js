import { supabase } from './supabaseClient';

/**
 * يحسب عدد الطلاب اللي عليهم متأخرات الشهر الحالي (لسه مدفوعش أو دفعوا جزء).
 * أي طالب مالوش سجل دفعة لسه (لم تُفتح شاشة الحسابات هذا الشهر) يُحسب "لم يدفع" افتراضياً،
 * بنفس منطق شاشة الحسابات.
 */
export async function getOverdueCount() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: students } = await supabase.from('students').select('id');
  const { data: payments } = await supabase
    .from('payments')
    .select('student_id, status')
    .eq('year', year)
    .eq('month', month);

  const statusByStudent = {};
  (payments || []).forEach((p) => {
    statusByStudent[p.student_id] = p.status;
  });

  return (students || []).filter((s) => (statusByStudent[s.id] || 'unpaid') !== 'paid').length;
}
