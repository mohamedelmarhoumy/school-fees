'use client';

import useSWR from 'swr';
import { supabase } from './supabaseClient';

async function fetchStudentsIndex() {
  const { data, error } = await supabase.from('students').select('id, name, student_number, group_id, parent_token');
  if (error) throw error;
  return data || [];
}

/**
 * فهرس خفيف بكل الطلاب (بدون تفاصيل زيادة) متخزّن في الكاش المحلي عن طريق SWR.
 * أول ما الشاشة تتفتح بيرجع فوراً آخر نسخة معروفة (حتى من غير نت)، وبعدين
 * بيحدّث نفسه في الخلفية بهدوء. ده اللي بيخلي ماسح الـ QR يتعرف على الطالب
 * من غير ما يستنى أي رد من السيرفر.
 * byId بيتفيد لكروت اتطبعت بالصيغة القديمة (STU:id)، و byToken للصيغة
 * الحالية (رابط /p/[parent_token]).
 */
export function useStudentsIndex() {
  const { data, mutate, isLoading } = useSWR('students-index-v1', fetchStudentsIndex);
  const byId = new Map((data || []).map((s) => [s.id, s]));
  const byToken = new Map((data || []).filter((s) => s.parent_token).map((s) => [s.parent_token, s]));
  return { students: data || [], byId, byToken, isLoading, mutate };
}
