'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ARABIC_MONTHS, ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '../../../lib/constants';
import { SkeletonCards } from '../../../lib/Skeleton';
import EmptyState from '../../../lib/EmptyState';

export default function ParentReportPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/parent-report?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'تعذّر تحميل البيانات.');
        return body;
      })
      .then((body) => {
        if (active) setData(body);
      })
      .catch((err) => {
        if (active) setError(err.message || 'تعذّر تحميل البيانات.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="page parent-page">
      <div className="parent-brand">
        <img src="/icons/icon-192.png" alt="حصتي" className="parent-brand-logo" />
        <div>
          <div className="parent-brand-title">حصتي</div>
          <div className="muted" style={{ fontSize: 12 }}>متابعة الطالب لولي الأمر</div>
        </div>
      </div>

      {loading && <SkeletonCards count={4} />}

      {!loading && error && <EmptyState title="تعذّر فتح الصفحة" hint={error} />}

      {!loading && !error && data && <ParentReportContent data={data} />}
    </div>
  );
}

function ParentReportContent({ data }) {
  const { student, grade, group, teacher, period, attendance, payments, scores } = data;
  const monthLabel = `${ARABIC_MONTHS[period.month - 1]} ${period.year}`;
  const currentPayment = payments.current;
  const paymentStatus = currentPayment?.status || 'unpaid';
  const remaining = currentPayment
    ? Math.max(0, (currentPayment.amount_due || 0) - (currentPayment.amount_paid || 0) - (currentPayment.discount_amount || 0))
    : null;

  return (
    <div>
      <div className="card">
        <h2 style={{ margin: '0 0 4px' }}>{student.name}</h2>
        <div className="muted">
          {student.student_number ? `رقم الطالب: ${student.student_number}` : null}
        </div>
        <div className="muted">
          {grade?.name || '—'} {group?.name ? `/ ${group.name}` : ''}
        </div>
        {group?.schedule_label && <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>موعد المجموعة: {group.schedule_label}</div>}
        {teacher?.display_name && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
            المدرس: {teacher.display_name}{teacher.subject_name ? ` — ${teacher.subject_name}` : ''}
          </div>
        )}
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">نسبة الحضور — {monthLabel}</div>
          <div className="summary-value">{attendance.monthly.rate != null ? `${attendance.monthly.rate}%` : '—'}</div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${attendance.monthly.rate ?? 0}%` }} />
          </div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
            {attendance.monthly.total > 0
              ? `حضر ${attendance.monthly.present + attendance.monthly.late} من ${attendance.monthly.total} حصة`
              : 'لا يوجد سجل حضور هذا الشهر بعد'}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-label">حالة الاشتراك — {monthLabel}</div>
          <div className="row" style={{ marginTop: 4 }}>
            <span className="badge" style={{ background: PAYMENT_STATUS_COLORS[paymentStatus] }}>
              {PAYMENT_STATUS_LABELS[paymentStatus]}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
            {currentPayment
              ? remaining > 0
                ? `متبقّي: ${remaining} ج.م`
                : 'مسدّد بالكامل ✅'
              : 'لا يوجد سجل اشتراك لهذا الشهر بعد'}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-label">معدّل درجاته</div>
          <div className="summary-value">{scores.summary.percent != null ? `${scores.summary.percent}%` : '—'}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
            {scores.summary.count > 0 ? `${scores.summary.count} كويز/واجب مسجّل` : 'لا يوجد درجات مسجّلة بعد'}
          </div>
        </div>
      </div>

      <div className="parent-section-title">📝 درجات الكويزات والواجبات</div>
      {scores.rows.length === 0 && <EmptyState title="لا يوجد درجات مسجّلة بعد" />}
      {scores.rows.map((s, i) => (
        <div key={i} className="card row-between">
          <div>
            <div style={{ fontWeight: 600 }}>{s.lesson_name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{s.quiz_date}{s.note ? ` — ${s.note}` : ''}</div>
          </div>
          <div style={{ fontWeight: 700 }}>{s.score} / {s.max_score}</div>
        </div>
      ))}

      <div className="parent-section-title">💳 سجل الاشتراك</div>
      {payments.rows.length === 0 && <EmptyState title="لا يوجد سجل اشتراكات بعد" />}
      {payments.rows.map((p, i) => (
        <div key={i} className="card row-between">
          <div className="row">
            <span className="dot" style={{ background: PAYMENT_STATUS_COLORS[p.status] }} />
            <span>{ARABIC_MONTHS[p.month - 1]} {p.year}</span>
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            المستحق: {p.amount_due} | المدفوع: {p.amount_paid}
            {p.discount_amount > 0 ? ` | خصم: ${p.discount_amount}` : ''}
          </div>
        </div>
      ))}

      <div className="parent-section-title">📅 سجل الحضور</div>
      {attendance.rows.length === 0 && <EmptyState title="لا يوجد سجل حضور بعد" />}
      {attendance.rows.slice(0, 20).map((a, i) => (
        <div key={i} className="card row-between">
          <span>{a.date}</span>
          <span className="badge" style={{ background: ATTENDANCE_STATUS_COLORS[a.status] }}>
            {ATTENDANCE_STATUS_LABELS[a.status]}
          </span>
        </div>
      ))}
      {attendance.rows.length > 20 && (
        <div className="muted" style={{ textAlign: 'center', fontSize: 12.5 }}>
          + {attendance.rows.length - 20} يوم أقدم
        </div>
      )}

      <div className="muted" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 18, marginBottom: 6 }}>
        صفحة متابعة للقراءة فقط — تُحدَّث تلقائياً أول ما المدرس يسجّل أي جديد.
      </div>
    </div>
  );
}
