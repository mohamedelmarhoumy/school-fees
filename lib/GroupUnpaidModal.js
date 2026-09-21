'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { buildWhatsAppLink } from './whatsapp';
import { ARABIC_MONTHS } from './constants';
import { useProfile } from './useProfile';
import { logActivity } from './activityLog';
import Button from './Button';
import { SkeletonCards } from './Skeleton';
import EmptyState from './EmptyState';
import { IconClose } from './icons';

export default function GroupUnpaidModal({ open, onClose, groupId, groupName, onChanged }) {
  const { profile, isOwner } = useProfile();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editPaid, setEditPaid] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const load = async () => {
    if (!groupId) return;
    setLoading(true);
    const { data: students } = await supabase.from('students').select('*').eq('group_id', groupId);
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .in('student_id', (students || []).map((s) => s.id));

    const paymentByStudent = {};
    (payments || []).forEach((p) => {
      paymentByStudent[p.student_id] = p;
    });

    const unpaid = (students || [])
      .map((s) => ({ student: s, payment: paymentByStudent[s.id] }))
      .filter((r) => (r.payment?.status || 'unpaid') !== 'paid');

    setRows(unpaid);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupId]);

  if (!open) return null;

  const startEdit = (row) => {
    setEditingId(row.student.id);
    setEditPaid(row.payment?.amount_paid ? String(row.payment.amount_paid) : '');
    setEditDiscount(row.payment?.discount_amount ? String(row.payment.discount_amount) : '');
  };

  const savePayment = async (row) => {
    if (!row.payment) return;
    const due = row.payment.amount_due;
    const paid = Number(editPaid) || 0;
    const discount = Number(editDiscount) || 0;
    const covered = paid + discount;
    const status = covered <= 0 ? 'unpaid' : covered >= due ? 'paid' : 'partial';
    const previousPaid = Number(row.payment.amount_paid || 0);
    const delta = paid - previousPaid;

    setSaving(true);
    await supabase
      .from('payments')
      .update({ amount_paid: paid, discount_amount: discount, status, updated_at: new Date().toISOString() })
      .eq('id', row.payment.id);

    if (delta !== 0) {
      await supabase.from('payment_transactions').insert({
        student_id: row.student.id,
        payment_id: row.payment.id,
        amount: delta,
      });
      logActivity(
        profile?.display_name || profile?.email,
        'payment',
        `${row.student.name} — ${delta > 0 ? `حصّل ${delta}` : `تعديل ${delta}`} جنيه (${ARABIC_MONTHS[month - 1]} ${year})`
      );
    }

    setEditingId(null);
    setSaving(false);
    await load();
    onChanged?.();
  };

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>متأخرات — {groupName}</strong>
          <button className="icon-btn" onClick={onClose}><IconClose size={15} /></button>
        </div>
        <div className="muted" style={{ marginTop: 2 }}>{ARABIC_MONTHS[month - 1]} {year}</div>

        {loading && <div style={{ marginTop: 10 }}><SkeletonCards count={2} /></div>}

        {!loading && rows.length === 0 && (
          <div style={{ marginTop: 10 }}>
            <EmptyState title="كل طلاب المجموعة دافعين 🎉" />
          </div>
        )}

        {!loading &&
          rows.map((row) => {
            const remaining = (row.payment?.amount_due || 0) - (row.payment?.amount_paid || 0) - (row.payment?.discount_amount || 0);
            return (
              <div key={row.student.id} className="card" style={{ marginTop: 10 }}>
                <div className="row-between">
                  <div>
                    <strong>{row.student.name}</strong>
                    <div className="muted" style={{ fontSize: 12.5 }}>{row.student.parent_phone || 'مفيش رقم'}</div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div className="muted" style={{ fontSize: 11.5 }}>المتبقي</div>
                    <strong style={{ color: '#dc2626' }}>{remaining.toFixed(0)} جنيه</strong>
                  </div>
                </div>

                {editingId === row.student.id ? (
                  <div className="row" style={{ marginTop: 10 }}>
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
                    <Button size="sm" loading={saving} onClick={() => savePayment(row)}>حفظ</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>إلغاء</Button>
                  </div>
                ) : (
                  <div className="row" style={{ marginTop: 10 }}>
                    <Button variant="outline" size="sm" onClick={() => startEdit(row)}>💰 دفع</Button>
                    {row.student.parent_phone && (
                      <Button
                        as="a"
                        variant="whatsapp"
                        size="sm"
                        href={buildWhatsAppLink(
                          row.student.parent_phone,
                          `تذكير: يرجى سداد اشتراك ${ARABIC_MONTHS[month - 1]} ${year} للطالب ${row.student.name}. المتبقي: ${remaining.toFixed(0)} جنيه. شكراً.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        واتساب
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
