import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabaseAdmin';
import { scheduleLabel } from '../../../lib/schedule';
import { monthlyAttendanceSummary, currentMonthPayment, scoresSummary } from '../../../lib/studentSummary';

export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'رابط غير صالح.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // ⚠️ بنقرا هنا بمفتاح service_role (يتخطى RLS عمداً) — لكن بمطابقة
    // parent_token بالظبط بس، فمفيش أي طريقة يوصل بيها حد لبيانات طالب تاني
    // أو لأي بيانات عن المدرس نفسه غير اللي بنرجّعه بوضوح تحت.
    const { data: student, error: studentError } = await admin
      .from('students')
      .select('id, name, student_number, grade_id, group_id, teacher_id, parent_name')
      .eq('parent_token', token)
      .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json({ error: 'الرابط غير صحيح أو منتهي.' }, { status: 404 });
    }

    const [{ data: grade }, { data: group }, { data: teacherProfile }, { data: payments }, { data: attendance }, { data: scores }] =
      await Promise.all([
        student.grade_id
          ? admin.from('grades').select('name, monthly_fee').eq('id', student.grade_id).single()
          : Promise.resolve({ data: null }),
        student.group_id
          ? admin.from('groups_table').select('name, days_of_week, start_time, end_time').eq('id', student.group_id).single()
          : Promise.resolve({ data: null }),
        admin.from('profiles').select('display_name, subject_name').eq('id', student.teacher_id).maybeSingle(),
        admin
          .from('payments')
          .select('year, month, amount_due, amount_paid, discount_amount, status')
          .eq('student_id', student.id)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(12),
        admin.from('attendance').select('date, status').eq('student_id', student.id).order('date', { ascending: false }).limit(90),
        admin
          .from('student_scores')
          .select('quiz_date, lesson_name, score, max_score, note')
          .eq('student_id', student.id)
          .order('quiz_date', { ascending: false })
          .limit(100),
      ]);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    return NextResponse.json({
      student: { name: student.name, student_number: student.student_number },
      grade: grade ? { name: grade.name, monthly_fee: grade.monthly_fee } : null,
      group: group ? { name: group.name, schedule_label: scheduleLabel(group) } : null,
      teacher: teacherProfile ? { display_name: teacherProfile.display_name, subject_name: teacherProfile.subject_name } : null,
      period: { year, month },
      attendance: {
        rows: attendance || [],
        monthly: monthlyAttendanceSummary(attendance, year, month),
      },
      payments: {
        rows: payments || [],
        current: currentMonthPayment(payments, year, month),
      },
      scores: {
        rows: scores || [],
        summary: scoresSummary(scores),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'حصلت مشكلة غير متوقعة.' }, { status: 500 });
  }
}
