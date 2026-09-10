'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { buildWhatsAppLink } from '../../../lib/whatsapp';
import { ARABIC_MONTHS, PAYMENT_STATUS_COLORS } from '../../../lib/constants';

const now = new Date();

export default function AccountsPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]); // { student, payment }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editPaid, setEditPaid] = useState('');
  const [editDiscount, setEditDiscount] = useState('');

  const computeStatus = (due, paid, discount) => {
    const covered = Number(paid) + Number(discount);
    if (covered <= 0) return 'unpaid';
    if (covered >= Number(due)) return 'paid';
    return 'partial';
  };

  const load = async () => {
    setLoading(true);

    const { data: students } = await supabase.from('students').select('*, grades(monthly_fee)').order('name');
    const { data: existingPayments } = await supabase
      .from('payments')
      .select('*')
      .eq('year', year)
      .eq('month', month);

    const paymentsByStudent = {};
    (existingPayments || []).forEach((p) => {
      paymentsByStudent[p.student_id] = p;
    });

    // ensure month generated: أنشئ سجل "لم يدفع" لأي طالب ليس له سجل هذا الشهر
    const toInsert = (students || [])
      .filter((s) => !paymentsByStudent[s.id])
      .map((s) => ({
        student_id: s.id,
        year,
        month,
        amount_due: s.grades?.monthly_fee || 0,
        amount_paid: 0,
        discount_amount: 0,
        status: 'unpaid',
      }));

    if (toInsert.length > 0) {
      const { data: inserted } = await supabase.from('payments').insert(toInsert).select();
      (inserted || []).forEach((p) => {
        paymentsByStudent[p.student_id] = p;
      });
    }

    const combined = (students || []).map((s) => ({ student: s, payment: paymentsByStudent[s.id] }));
    setRows(combined);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const startEdit = (row) => {
    setEditingStudentId(row.student.id);
    setEditPaid(String(row.payment?.amount_paid ?? 0));
    setEditDiscount(String(row.payment?.discount_amount ?? 0));
  };

  const savePayment = async (row) => {
    const due = row.payment?.amount_due ?? 0;
    const paid = Number(editPaid) || 0;
    const discount = Number(editDiscount) || 0;
    const status = computeStatus(due, paid, discount);

    await supabase
      .from('payments')
      .update({ amount_paid: paid, discount_amount: discount, status, updated_at: new Date().toISOString() })
      .eq('id', row.payment.id);

    setEditingStudentId(null);
    load();
  };

  const filtered = rows.filter((r) => r.student.name.toLowerCase().includes(search.toLowerCase()));

  const totalDue = rows.reduce((sum, r) => sum + Number(r.payment?.amount_due || 0), 0);
  const totalPaid = rows.reduce((sum, r) => sum + Number(r.payment?.amount_paid || 0), 0);

  return (
    <div>
      <h2>الحسابات والاشتراكات</h2>

      <div className="card row">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {ARABIC_MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <div className="muted" style={{ marginRight: 'auto' }}>
          المستحق: {totalDue} | المحصّل: {totalPaid}
        </div>
      </div>

      <input
        placeholder="بحث باسم الطالب..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 10 }}
      />

      {loading && <div className="muted">جارِ التحميل...</div>}

      {!loading && filtered.map((row) => {
        const p = row.payment;
        const status = p?.status || 'unpaid';
        return (
          <div key={row.student.id} className="card">
            <div className="row-between">
              <div className="row">
                <span className="dot" style={{ background: PAYMENT_STATUS_COLORS[status] }} />
                <strong>{row.student.name}</strong>
              </div>
              <div className="row">
                {status !== 'paid' && (
                  <a
                    className="btn btn-whatsapp btn-sm"
                    href={buildWhatsAppLink(
                      row.student.parent_phone,
                      `تذكير: يرجى سداد اشتراك ${ARABIC_MONTHS[month - 1]} ${year} للطالب ${row.student.name}. المتبقي: ${(
                        (p?.amount_due || 0) - (p?.amount_paid || 0) - (p?.discount_amount || 0)
                      ).toFixed(0)} جنيه. شكراً.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    واتساب
                  </a>
                )}
                <button className="btn btn-outline btn-sm" onClick={() => startEdit(row)}>دفع</button>
              </div>
            </div>

            {editingStudentId === row.student.id && (
              <div className="row" style={{ marginTop: 10 }}>
                <span className="muted">المستحق: {p?.amount_due}</span>
                <input
                  type="number"
                  placeholder="المبلغ المدفوع"
                  value={editPaid}
                  onChange={(e) => setEditPaid(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  placeholder="الخصم"
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-sm" onClick={() => savePayment(row)}>حفظ</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingStudentId(null)}>إلغاء</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
