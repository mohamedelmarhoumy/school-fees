'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { downloadCsv } from '../../../lib/exportCsv';
import { ARABIC_MONTHS } from '../../../lib/constants';

const now = new Date();

export default function DashboardPage() {
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState({ paid: 0, partial: 0, unpaid: 0, totalDue: 0, totalPaid: 0 });
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    };
    load();
  }, [year, month]);

  const exportPayments = async () => {
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
  };

  const exportAttendanceToday = async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: records } = await supabase
      .from('attendance')
      .select('*, students(name)')
      .eq('date', todayStr);
    const rows = (records || []).map((r) => [r.students?.name || '', r.date, r.status]);
    downloadCsv(`حضور-${todayStr}.csv`, ['اسم الطالب', 'التاريخ', 'الحالة'], rows);
  };

  return (
    <div>
      <h2>الرئيسية</h2>

      {loading ? (
        <div className="muted">جارِ التحميل...</div>
      ) : (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{ARABIC_MONTHS[month - 1]} {year}</h3>
            <div className="row" style={{ justifyContent: 'space-evenly', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{summary.paid || 0}</div>
                <div className="muted">دافع</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#ea580c' }}>{summary.partial || 0}</div>
                <div className="muted">جزئي</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{summary.unpaid || 0}</div>
                <div className="muted">لم يدفع</div>
              </div>
            </div>
            <div className="muted" style={{ marginTop: 10, textAlign: 'center' }}>
              إجمالي المستحق: {summary.totalDue} | إجمالي المحصّل: {summary.totalPaid}
            </div>
          </div>

          <div className="card">
            <div className="row">
              <button className="btn" onClick={exportPayments}>تصدير تحصيل الشهر (CSV)</button>
              <button className="btn btn-outline" onClick={exportAttendanceToday}>تصدير حضور اليوم (CSV)</button>
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
