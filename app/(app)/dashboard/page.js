'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { downloadCsv } from '../../../lib/exportCsv';
import { ARABIC_MONTHS, WEEKDAY_LABELS } from '../../../lib/constants';
import Button from '../../../lib/Button';

const now = new Date();
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function DashboardPage() {
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState({ paid: 0, partial: 0, unpaid: 0, totalDue: 0, totalPaid: 0 });
  const [todaysGroups, setTodaysGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingPayments, setExportingPayments] = useState(false);
  const [exportingAttendance, setExportingAttendance] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: payments } = await supabase.from('payments').select('*').eq('year', year).eq('month', month);
      const counts = { paid: 0, partial: 0, unpaid: 0, totalDue: 0, totalPaid: 0 };
      (payments || []).forEach((p) => {
        counts[p.status] = (counts[p.status] || 0) + 1;
        counts.totalDue += Number(p.amount_due);
        counts.totalPaid += Number(p.amount_paid) + Number(p.discount_amount);
      });
      setSummary(counts);

      const { data: groups } = await supabase.from('groups_table').select('*, grades(name)');
      const todayWeekday = new Date().getDay();
      const todays = (groups || [])
        .filter((g) => (g.days_of_week || []).includes(todayWeekday))
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      setTodaysGroups(todays);

      setLoading(false);
    };
    load();
  }, [year, month]);

  const exportPayments = async () => {
    setExportingPayments(true);
    const { data: payments } = await supabase
      .from('payments')
      .select('*, students(name)')
      .eq('year', year)
      .eq('month', month);
    const rows = (payments || []).map((p) => [
      p.students?.name || '',
      p.amount_due,
      p.amount_paid,
      p.discount_amount,
      p.status,
    ]);
    downloadCsv(
      `تحصيل-${ARABIC_MONTHS[month - 1]}-${year}.csv`,
      ['اسم الطالب', 'المستحق', 'المدفوع', 'الخصم', 'الحالة'],
      rows
    );
    setExportingPayments(false);
  };

  const exportAttendanceToday = async () => {
    setExportingAttendance(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data: records } = await supabase
      .from('attendance')
      .select('*, students(name)')
      .eq('date', today);
    const rows = (records || []).map((r) => [r.students?.name || '', r.date, r.status]);
    downloadCsv(`حضور-${today}.csv`, ['اسم الطالب', 'التاريخ', 'الحالة'], rows);
    setExportingAttendance(false);
  };

  return (
    <div>
      <h2>الرئيسية</h2>

      {loading ? (
        <div className="muted">جارِ التحميل...</div>
      ) : (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>مجموعات اليوم ({WEEKDAY_LABELS[new Date().getDay()]})</h3>
            {todaysGroups.length === 0 && (
              <div className="muted">لا توجد مجموعات مجدولة اليوم.</div>
            )}
            {todaysGroups.map((g) => (
              <Link
                key={g.id}
                href={`/attendance?groupId=${g.id}&date=${todayStr()}`}
                className="row-between"
                style={{ padding: '8px 0', borderBottom: '1px solid #f1f2f4' }}
              >
                <div>
                  <strong>{g.grades?.name}</strong> — {g.name}
                </div>
                <span className="muted">
                  {g.start_time ? `${g.start_time.slice(0, 5)} - ${g.end_time?.slice(0, 5) || ''}` : ''}
                </span>
              </Link>
            ))}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>{ARABIC_MONTHS[month - 1]} {year}</h3>
            <div className="stat-grid">
              <div className="stat-card stat-paid">
                <div className="stat-value">{summary.paid || 0}</div>
                <div className="stat-label">دافع</div>
              </div>
              <div className="stat-card stat-partial">
                <div className="stat-value">{summary.partial || 0}</div>
                <div className="stat-label">جزئي</div>
              </div>
              <div className="stat-card stat-unpaid">
                <div className="stat-value">{summary.unpaid || 0}</div>
                <div className="stat-label">لم يدفع</div>
              </div>
            </div>
            <div className="muted" style={{ marginTop: 12, textAlign: 'center' }}>
              إجمالي المستحق: {summary.totalDue} | إجمالي المحصّل: {summary.totalPaid}
            </div>
          </div>

          <div className="card">
            <div className="row">
              <Button variant="primary" loading={exportingPayments} onClick={exportPayments}>
                تصدير تحصيل الشهر (CSV)
              </Button>
              <Button variant="outline" loading={exportingAttendance} onClick={exportAttendanceToday}>
                تصدير حضور اليوم (CSV)
              </Button>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              الملفات تفتح مباشرة في Excel.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
