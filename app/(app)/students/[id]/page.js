'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { ARABIC_MONTHS, PAYMENT_STATUS_COLORS, ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from '../../../../lib/constants';

export default function StudentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tab, setTab] = useState('payments');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: studentData } = await supabase.from('students').select('*').eq('id', id).single();
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', id)
        .order('date', { ascending: false });
      setStudent(studentData);
      setPayments(paymentsData || []);
      setAttendance(attendanceData || []);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="muted">جارِ التحميل...</div>;
  if (!student) return <div className="muted">الطالب غير موجود.</div>;

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;
  const lateCount = attendance.filter((a) => a.status === 'late').length;

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={() => router.back()} style={{ marginBottom: 10 }}>
        ← رجوع
      </button>

      <div className="card">
        <h2 style={{ margin: '0 0 4px' }}>{student.name}</h2>
        <div className="muted">رقم الطالب: {student.student_number || '—'}</div>
        <div className="muted">رقم ولي الأمر: {student.parent_phone || '—'}</div>
      </div>

      <div className="tabs">
        <button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>الاشتراكات</button>
        <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>الحضور</button>
      </div>

      {tab === 'payments' && (
        <div>
          {payments.length === 0 && <div className="muted">لا يوجد سجل اشتراكات بعد.</div>}
          {payments.map((p) => (
            <div key={p.id} className="card row-between">
              <div className="row">
                <span className="dot" style={{ background: PAYMENT_STATUS_COLORS[p.status] }} />
                <span>{ARABIC_MONTHS[p.month - 1]} {p.year}</span>
              </div>
              <div className="muted">
                المستحق: {p.amount_due} | المدفوع: {p.amount_paid}
                {p.discount_amount > 0 ? ` | خصم: ${p.discount_amount}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          <div className="card row" style={{ justifyContent: 'space-evenly', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{presentCount}</div>
              <div className="muted">حضر</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{absentCount}</div>
              <div className="muted">غاب</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ea580c' }}>{lateCount}</div>
              <div className="muted">تأخير</div>
            </div>
          </div>
          {attendance.length === 0 && <div className="muted">لا يوجد سجل حضور بعد.</div>}
          {attendance.map((a) => (
            <div key={a.id} className="card row-between">
              <span>{a.date}</span>
              <span className="badge" style={{ background: ATTENDANCE_STATUS_COLORS[a.status] }}>
                {ATTENDANCE_STATUS_LABELS[a.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
