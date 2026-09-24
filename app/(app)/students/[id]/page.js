'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { ARABIC_MONTHS, PAYMENT_STATUS_COLORS, ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from '../../../../lib/constants';
import { studentQrDataUrl } from '../../../../lib/qr';
import { printStudentCard } from '../../../../lib/printStudentCard';
import Button from '../../../../lib/Button';
import { useProfile } from '../../../../lib/useProfile';

export default function StudentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [grade, setGrade] = useState(null);
  const [group, setGroup] = useState(null);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tab, setTab] = useState('payments');
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const { profile } = useProfile();

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

      if (studentData?.grade_id) {
        const { data: gradeData } = await supabase.from('grades').select('*').eq('id', studentData.grade_id).single();
        setGrade(gradeData || null);
      }
      if (studentData?.group_id) {
        const { data: groupData } = await supabase.from('groups_table').select('*').eq('id', studentData.group_id).single();
        setGroup(groupData || null);
      }
      if (studentData?.id) {
        setQrDataUrl(await studentQrDataUrl(studentData.id));
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handlePrintCard = () => {
    if (!student || !qrDataUrl) return;
    printStudentCard({
      studentName: student.name,
      studentNumber: student.student_number,
      gradeName: grade?.name,
      groupName: group?.name,
      qrDataUrl,
      schoolName: profile?.subject_name || 'كارنيه الطالب',
    });
  };

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
        <button className={tab === 'qr' ? 'active' : ''} onClick={() => setTab('qr')}>بطاقة QR</button>
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

      {tab === 'qr' && (
        <div className="card">
          <div className="qr-card-box">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR — ${student.name}`} />
            ) : (
              <div className="muted">جارِ توليد الكود...</div>
            )}
            <div className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
              كود خاص بالطالب — استخدمه في شاشة الحضور بالكاميرا لتسجيل حضوره تلقائياً.
            </div>
            <Button variant="primary" onClick={handlePrintCard} disabled={!qrDataUrl} style={{ width: '100%', justifyContent: 'center' }}>
              🖨️ طباعة كارت الطالب
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
