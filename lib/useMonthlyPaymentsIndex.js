'use client';

import useSWR from 'swr';
import { supabase } from './supabaseClient';

/**
 * كل سجلات الاشتراكات لشهر معيّن، متخزّنة محلياً بنفس منطق useStudentsIndex.
 * بتُستخدم عشان نعرض شارة "دافع / عليه متأخرات" فوراً وقت مسح الـ QR من غير
 * ما نستنى استعلام لكل طالب لوحده.
 */
export function useMonthlyPaymentsIndex(year, month) {
  const key = year && month ? `payments-index-${year}-${month}` : null;
  const fetcher = async () => {
    const { data, error } = await supabase.from('payments').select('*').eq('year', year).eq('month', month);
    if (error) throw error;
    return data || [];
  };
  const { data, mutate } = useSWR(key, fetcher);
  const byStudent = new Map((data || []).map((p) => [p.student_id, p]));
  return { payments: data || [], byStudent, mutate };
}
