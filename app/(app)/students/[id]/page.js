'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import {
  ARABIC_MONTHS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
} from '../../../../lib/constants';
import { monthlyAttendanceSummary, currentMonthPayment, scoresSummary } from '../../../../lib/studentSummary';
import { studentQrDataUrl } from '../../../../lib/qr';
import { siteUrl } from '../../../../lib/siteUrl';
import { printStudentCard } from '../../../../lib/printStudentCard';
import { buildWhatsAppLink } from '../../../../lib/whatsapp';
import { logActivity } from '../../../../lib/activityLog';
import Button from '../../../../lib/Button';
import SlideUpModal from '../../../../lib/SlideUpModal';
import EmptyState from '../../../../lib/EmptyState';
import { IconPencil, IconTrash } from '../../../../lib/icons';
import { useProfile } from '../../../../lib/useProfile';

const emptyScoreForm = { quiz_date: new Date().toISOString().slice(0, 10), lesson_name: '', score: '', max_score: '10', note: '' };

export default function StudentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [grade, setGrade] = useState(null);
  const [group, setGroup] = useState(null);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [scores, setScores] = useState([]);
  const [tab, setTab] = useState('payments');
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const { profile, isOwner } = useProfile();
  const canManage = isOwner || !!profile?.can_students;

  const [scoreForm, setScoreForm] = useState(emptyScoreForm);
  const [editingScoreId, setEditingScoreId] = useState(null);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [savingScore, setSavingScore] = useState(false);

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
    const { data: scoresData } = await supabase
      .from('student_scores')
      .select('*')
      .eq('student_id', id)
      .order('quiz_date', { ascending: false });
    setStudent(studentData);
    setPayments(paymentsData || []);
    setAttendance(attendanceData || []);
    setScores(scoresData || []);

    if (studentData?.grade_id) {
      const { data: gradeData } = await supabase.from('grades').select('*').eq('id', studentData.grade_id).single();
      setGrade(gradeData || null);
    }
    if (studentData?.group_id) {
      const { data: groupData } = await supabase.from('groups_table').select('*').eq('id', studentData.group_id).single();
      setGroup(groupData || null);
    }
    if (studentData?.parent_token) {
      setQrDataUrl(await studentQrDataUrl(siteUrl(), studentData.parent_token));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      teacherName: profile?.display_name || '',
    });
  };

  const resetScoreForm = () => {
    setScoreForm(emptyScoreForm);
    setEditingScoreId(null);
  };

  const startAddScore = () => {
    resetScoreForm();
    setScoreModalOpen(true);
  };

  const startEditScore = (s) => {
    setEditingScoreId(s.id);
    setScoreForm({
      quiz_date: s.quiz_date,
      lesson_name: s.lesson_name,
      score: String(s.score),
      max_score: String(s.max_score),
      note: s.note || '',
    });
    setScoreModalOpen(true);
  };

  const saveScore = async (e) => {
    e.preventDefault();
    if (!scoreForm.lesson_name.trim()) return;
    setSavingScore(true);
    const actorName = profile?.display_name || profile?.email;
    const payload = {
      student_id: id,
      quiz_date: scoreForm.quiz_date,
      lesson_name: scoreForm.lesson_name.trim(),
      score: Number(scoreForm.score) || 0,
      max_score: Number(scoreForm.max_score) || 0,
      note: scoreForm.note.trim() || null,
    };
    if (editingScoreId) {
      await supabase.from('student_scores').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingScoreId);
      logActivity(actorName, 'score_updated', `تعديل درجة "${payload.lesson_name}" — ${student?.name}`);
    } else {
      await supabase.from('student_scores').insert(payload);
      logActivity(actorName, 'score_added', `درجة جديدة "${payload.lesson_name}" (${payload.score}/${payload.max_score}) — ${student?.name}`);
    }
    resetScoreForm();
    setScoreModalOpen(false);
    setSavingScore(false);
    await load();
  };

  const deleteScore = async (s) => {
    if (!confirm('حذف هذه الدرجة نهائياً؟')) return;
    await supabase.from('student_scores').delete().eq('id', s.id);
    logActivity(profile?.display_name || profile?.email, 'score_deleted', `حذف درجة "${s.lesson_name}" — ${student?.name}`);
    load();
  };

  if (loading) return <div className="muted">جارِ التحميل...</div>;
  if (!student) return <div className="muted">الطالب غير موجود.</div>;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthAttendance = monthlyAttendanceSummary(attendance, year, month);
  const monthPayment = currentMonthPayment(payments, year, month);
  const paymentStatus = monthPayment?.status || 'unpaid';
  const scoreSummary = scoresSummary(scores);

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;
  const lateCount = attendance.filter((a) => a.status === 'late').length;

  const parentLink = student.parent_token ? `${siteUrl()}/p/${student.parent_token}` : '';
  const parentGreeting = student.parent_name ? `مرحباً ${student.parent_name}` : 'مرحباً';
  const parentMessage = `${parentGreeting}، يمكنك متابعة حضور ودرجات واشتراك الطالب ${student.name} عبر الملف الإلكتروني التالي: ${parentLink}`;

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

      {/* ملخص مالي وحضور — لمحة سريعة قبل الدخول في التفاصيل */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">الحضور — {ARABIC_MONTHS[month - 1]}</div>
          <div className="summary-value">{monthAttendance.rate != null ? `${monthAttendance.rate}%` : '—'}</div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${monthAttendance.rate ?? 0}%` }} />
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">الاشتراك — {ARABIC_MONTHS[month - 1]}</div>
          <span className="badge" style={{ background: PAYMENT_STATUS_COLORS[paymentStatus] }}>
            {PAYMENT_STATUS_LABELS[paymentStatus]}
          </span>
        </div>
        <div className="summary-card">
          <div className="summary-label">معدّل الدرجات</div>
          <div className="summary-value">{scoreSummary.percent != null ? `${scoreSummary.percent}%` : '—'}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{scoreSummary.count} كويز/واجب</div>
        </div>
      </div>

      {student.parent_phone ? (
        <Button
          as="a"
          variant="whatsapp"
          style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
          href={buildWhatsAppLink(student.parent_phone, parentMessage)}
          target="_blank"
          rel="noreferrer"
        >
          📱 إرسال رابط المتابعة لولي الأمر
        </Button>
      ) : (
        <div className="muted" style={{ marginBottom: 12, fontSize: 12.5 }}>
          أضف رقم ولي الأمر من شاشة تعديل الطالب عشان تقدر تبعتله رابط المتابعة.
        </div>
      )}

      <div className="tabs">
        <button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>الاشتراكات</button>
        <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>الحضور</button>
        <button className={tab === 'scores' ? 'active' : ''} onClick={() => setTab('scores')}>الدرجات</button>
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

      {tab === 'scores' && (
        <div>
          {canManage && (
            <Button variant="outline" size="sm" style={{ marginBottom: 10 }} onClick={startAddScore}>
              + إضافة درجة
            </Button>
          )}
          {scores.length === 0 && <EmptyState title="لا يوجد درجات مسجّلة بعد" hint="سجّل درجة كويز أو واجب من زر الإضافة." />}
          {scores.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="scores-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>اسم الدرس</th>
                    <th>الدرجة</th>
                    <th>ملاحظة</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s) => (
                    <tr key={s.id}>
                      <td className="muted">{s.quiz_date}</td>
                      <td>{s.lesson_name}</td>
                      <td style={{ fontWeight: 700 }}>{s.score} / {s.max_score}</td>
                      <td className="muted">{s.note || '—'}</td>
                      {canManage && (
                        <td>
                          <div className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                            <button className="icon-action-btn icon-edit" title="تعديل" onClick={() => startEditScore(s)}>
                              <IconPencil size={15} />
                            </button>
                            <button className="icon-action-btn icon-delete" title="حذف" onClick={() => deleteScore(s)}>
                              <IconTrash size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
              كود ذكي: مسحه من شاشة الحضور بالتطبيق بيسجّل الحضور فوراً — ومسحه بكاميرا موبايل عادية بيفتح صفحة متابعة الطالب لولي الأمر مباشرة.
            </div>
            <Button variant="primary" onClick={handlePrintCard} disabled={!qrDataUrl} style={{ width: '100%', justifyContent: 'center' }}>
              🖨️ طباعة كارت الطالب
            </Button>
          </div>
        </div>
      )}

      <SlideUpModal
        open={scoreModalOpen}
        onClose={() => {
          setScoreModalOpen(false);
          resetScoreForm();
        }}
        title={editingScoreId ? 'تعديل الدرجة' : 'إضافة درجة كويز/واجب'}
      >
        <form onSubmit={saveScore}>
          <div className="row">
            <input
              type="date"
              value={scoreForm.quiz_date}
              onChange={(e) => setScoreForm({ ...scoreForm, quiz_date: e.target.value })}
              style={{ flex: 1 }}
              required
            />
            <input
              placeholder="اسم الدرس"
              value={scoreForm.lesson_name}
              onChange={(e) => setScoreForm({ ...scoreForm, lesson_name: e.target.value })}
              style={{ flex: 2 }}
              autoFocus
              required
            />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              type="number"
              placeholder="الدرجة"
              value={scoreForm.score}
              onChange={(e) => setScoreForm({ ...scoreForm, score: e.target.value })}
              style={{ flex: 1 }}
              required
            />
            <span className="muted">من</span>
            <input
              type="number"
              placeholder="الدرجة الكلية"
              value={scoreForm.max_score}
              onChange={(e) => setScoreForm({ ...scoreForm, max_score: e.target.value })}
              style={{ flex: 1 }}
              required
            />
          </div>
          <input
            placeholder="ملاحظة (اختياري)"
            value={scoreForm.note}
            onChange={(e) => setScoreForm({ ...scoreForm, note: e.target.value })}
            style={{ width: '100%', marginTop: 8 }}
          />
          <Button type="submit" loading={savingScore} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
            {editingScoreId ? 'حفظ التعديل' : 'إضافة الدرجة'}
          </Button>
        </form>
      </SlideUpModal>
    </div>
  );
}
