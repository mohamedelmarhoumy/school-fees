'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { buildWhatsAppLink } from '../../../lib/whatsapp';
import { ARABIC_MONTHS, PAYMENT_STATUS_COLORS } from '../../../lib/constants';
import Button from '../../../lib/Button';
import { SkeletonCards } from '../../../lib/Skeleton';
import EmptyState from '../../../lib/EmptyState';
import { downloadCsv } from '../../../lib/exportCsv';
import { useProfile } from '../../../lib/useProfile';
import { logActivity } from '../../../lib/activityLog';
import TrendChart from '../../../lib/TrendChart';
import { printReport } from '../../../lib/printReport';
import SlideUpModal from '../../../lib/SlideUpModal';
import { IconPencil, IconTrash } from '../../../lib/icons';

const now = new Date();
const todayDateStr = () => new Date().toISOString().slice(0, 10);

function dayBounds(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

const emptyExpenseForm = { title: '', amount: '', expense_date: todayDateStr(), notes: '' };

export default function AccountsPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]); // { student, payment }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editPaid, setEditPaid] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [todayTransactions, setTodayTransactions] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [trendData, setTrendData] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const { profile, isOwner, loading: profileLoading } = useProfile();
  const canManagePayments = isOwner || !!profile?.can_payments;
  const canViewFinancials = isOwner || !!profile?.can_view_financials;
  const [tab, setTab] = useState(null);

  // خانة المصروفات
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => {
    if (profileLoading) return; // منستنى نعرف الصلاحيات الحقيقية قبل ما نحدد التبويب الافتراضي
    if (tab === null) setTab(canManagePayments ? 'subscriptions' : 'expenses');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManagePayments, canViewFinancials, profileLoading]);

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

  const loadExpenses = async () => {
    setLoadingExpenses(true);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', start)
      .lte('expense_date', end)
      .order('expense_date', { ascending: false });
    setExpenses(data || []);
    setLoadingExpenses(false);
  };

  const loadTodayTransactions = async () => {
    setLoadingToday(true);
    const { start, end } = dayBounds(new Date());
    const { data } = await supabase
      .from('payment_transactions')
      .select('*, students(name)')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false });
    setTodayTransactions(data || []);
    setLoadingToday(false);
  };

  useEffect(() => {
    if (profileLoading) return; // منستنى نعرف الصلاحيات الحقيقية الأول عشان مانحكمش غلط إن مفيش صلاحية
    if (canManagePayments) load(); else setLoading(false);
    if (canViewFinancials) loadExpenses(); else setLoadingExpenses(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, profileLoading, canManagePayments, canViewFinancials]);

  const loadTrend = async () => {
    setLoadingTrend(true);
    const months = [];
    const cursor = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    const earliest = months[0];
    const { data } = await supabase
      .from('payments')
      .select('year, month, amount_paid, discount_amount')
      .gte('year', earliest.year);

    const totalsByKey = {};
    (data || []).forEach((p) => {
      const key = `${p.year}-${p.month}`;
      totalsByKey[key] = (totalsByKey[key] || 0) + Number(p.amount_paid) + Number(p.discount_amount);
    });

    const chartData = months.map((m) => ({
      label: ARABIC_MONTHS[m.month - 1],
      value: Math.round(totalsByKey[`${m.year}-${m.month}`] || 0),
    }));
    setTrendData(chartData);
    setLoadingTrend(false);
  };

  useEffect(() => {
    if (profileLoading) return;
    if (canManagePayments) loadTodayTransactions(); else setLoadingToday(false);
    if (canViewFinancials) loadTrend(); else setLoadingTrend(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, canManagePayments, canViewFinancials]);

  const startEdit = (row) => {
    setEditingStudentId(row.student.id);
    const paid = row.payment?.amount_paid;
    const discount = row.payment?.discount_amount;
    setEditPaid(paid ? String(paid) : '');
    setEditDiscount(discount ? String(discount) : '');
  };

  const savePayment = async (row) => {
    const due = row.payment?.amount_due ?? 0;
    const paid = Number(editPaid) || 0;
    const discount = Number(editDiscount) || 0;
    const status = computeStatus(due, paid, discount);
    const previousPaid = Number(row.payment?.amount_paid || 0);
    const delta = paid - previousPaid;

    setSavingPayment(true);

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

    setEditingStudentId(null);
    await load();
    await loadTodayTransactions();
    setSavingPayment(false);
  };

  // ===== المصروفات =====
  const startAddExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm(emptyExpenseForm);
    setExpenseModalOpen(true);
  };

  const startEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      title: expense.title,
      amount: String(expense.amount),
      expense_date: expense.expense_date,
      notes: expense.notes || '',
    });
    setExpenseModalOpen(true);
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title.trim()) return;
    setSavingExpense(true);
    const payload = {
      title: expenseForm.title.trim(),
      amount: Number(expenseForm.amount) || 0,
      expense_date: expenseForm.expense_date,
      notes: expenseForm.notes.trim() || null,
    };
    const actorName = profile?.display_name || profile?.email;
    if (editingExpenseId) {
      await supabase.from('expenses').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingExpenseId);
      logActivity(actorName, 'expense_updated', `تعديل مصروف: ${payload.title} (${payload.amount} جنيه)`);
    } else {
      await supabase.from('expenses').insert(payload);
      logActivity(actorName, 'expense_added', `مصروف جديد: ${payload.title} (${payload.amount} جنيه)`);
    }
    setSavingExpense(false);
    setExpenseModalOpen(false);
    await loadExpenses();
  };

  const deleteExpense = async (expense) => {
    if (!confirm(`حذف مصروف "${expense.title}"؟`)) return;
    await supabase.from('expenses').delete().eq('id', expense.id);
    logActivity(profile?.display_name || profile?.email, 'expense_deleted', `حذف مصروف: ${expense.title}`);
    loadExpenses();
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    const { data: payments } = await supabase
      .from('payments')
      .select('*, students(name)')
      .eq('year', year)
      .eq('month', month)
      .order('students(name)');

    const statusLabel = { paid: 'دافع', partial: 'جزئي', unpaid: 'لم يدفع' };
    const pdfRows = (payments || []).map((p) => [
      p.students?.name || '',
      p.amount_due,
      p.amount_paid,
      p.discount_amount,
      statusLabel[p.status] || p.status,
    ]);
    const totalDueMonth = (payments || []).reduce((s, p) => s + Number(p.amount_due), 0);
    const totalPaidMonth = (payments || []).reduce((s, p) => s + Number(p.amount_paid) + Number(p.discount_amount), 0);
    const totalExpensesMonth = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const netProfitMonth = totalPaidMonth - totalExpensesMonth;

    printReport({
      title: `تقرير تحصيل ${ARABIC_MONTHS[month - 1]} ${year}`,
      subtitle: `حصتي — تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}`,
      columns: ['اسم الطالب', 'المستحق', 'المدفوع', 'الخصم', 'الحالة'],
      rows: pdfRows,
      totalsLine: `إجمالي المستحق: ${totalDueMonth} | إجمالي المحصّل: ${totalPaidMonth} | إجمالي المصروفات: ${totalExpensesMonth} | صافي الربح: ${netProfitMonth} جنيه`,
    });
    setExportingPdf(false);
  };

  const exportPayments = async () => {
    setExporting(true);
    const { data: payments } = await supabase
      .from('payments')
      .select('*, students(name)')
      .eq('year', year)
      .eq('month', month);
    const csvRows = (payments || []).map((p) => [
      p.students?.name || '',
      p.amount_due,
      p.amount_paid,
      p.discount_amount,
      p.status,
    ]);
    downloadCsv(
      `تحصيل-${ARABIC_MONTHS[month - 1]}-${year}.csv`,
      ['اسم الطالب', 'المستحق', 'المدفوع', 'الخصم', 'الحالة'],
      csvRows
    );
    setExporting(false);
  };

  const filtered = rows
    .filter((r) => (r.payment?.status || 'unpaid') !== 'paid')
    .filter((r) => r.student.name.toLowerCase().includes(search.toLowerCase()));

  const totalDue = rows.reduce((sum, r) => sum + Number(r.payment?.amount_due || 0), 0);
  const totalPaid = rows.reduce((sum, r) => sum + Number(r.payment?.amount_paid || 0), 0);
  const statusCounts = rows.reduce(
    (acc, r) => {
      const s = r.payment?.status || 'unpaid';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    { paid: 0, partial: 0, unpaid: 0 }
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netProfit = totalPaid - totalExpenses;

  const todayTotal = todayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  if (profileLoading) {
    return (
      <div>
        <h2>الحسابات</h2>
        <SkeletonCards count={4} />
      </div>
    );
  }

  if (!canManagePayments && !canViewFinancials) {
    return <EmptyState title="غير مصرح لك بالدخول هنا" hint="مفيش صلاحية تحصيل أو اطّلاع مالي على حسابك." />;
  }

  return (
    <div>
      <h2>الحسابات</h2>

      <div className="card">
        <div className="row">
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
        </div>

        {canViewFinancials && (
        <>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <div className="stat-card stat-paid">
            <div className="stat-value">{statusCounts.paid}</div>
            <div className="stat-label">دافع</div>
          </div>
          <div className="stat-card stat-partial">
            <div className="stat-value">{statusCounts.partial}</div>
            <div className="stat-label">جزئي</div>
          </div>
          <div className="stat-card stat-unpaid">
            <div className="stat-value">{statusCounts.unpaid}</div>
            <div className="stat-label">لم يدفع</div>
          </div>
        </div>

        <div className="stat-grid" style={{ marginTop: 8 }}>
          <div className="stat-card" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
            <div className="stat-value" style={{ fontSize: 17 }}>{totalPaid.toFixed(0)}</div>
            <div className="stat-label">إجمالي التحصيل</div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
            <div className="stat-value" style={{ fontSize: 17 }}>{totalExpenses.toFixed(0)}</div>
            <div className="stat-label">إجمالي المصروفات</div>
          </div>
          <div
            className="stat-card"
            style={{
              background: netProfit >= 0 ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
              color: netProfit >= 0 ? '#16a34a' : '#dc2626',
            }}
          >
            <div className="stat-value" style={{ fontSize: 17 }}>{netProfit.toFixed(0)}</div>
            <div className="stat-label">صافي الربح</div>
          </div>
        </div>

        <div className="muted" style={{ marginTop: 12, textAlign: 'center' }}>
          إجمالي المستحق: {totalDue}
        </div>

        <div className="row" style={{ marginTop: 10, justifyContent: 'center' }}>
          <Button variant="outline" size="sm" loading={exporting} onClick={exportPayments}>
            تصدير تحصيل الشهر (CSV)
          </Button>
          <Button variant="outline" size="sm" loading={exportingPdf} onClick={exportPdf}>
            طباعة / PDF
          </Button>
        </div>
        </>
        )}
      </div>

      {canManagePayments && canViewFinancials && (
        <div className="tabs">
          <button className={tab === 'subscriptions' ? 'active' : ''} onClick={() => setTab('subscriptions')}>الاشتراكات</button>
          <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>المصروفات</button>
        </div>
      )}

      {tab === 'subscriptions' && canManagePayments && (
        <div>
          {canViewFinancials && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>اتجاه التحصيل (آخر 6 شهور)</h3>
              {loadingTrend ? (
                <div className="muted">جارِ التحميل...</div>
              ) : (
                <TrendChart data={trendData} />
              )}
            </div>
          )}

          {canViewFinancials && (
          <div className="card">
            <div className="row-between">
              <h3 style={{ margin: 0 }}>المحصّل اليوم</h3>
              <strong style={{ color: '#16a34a' }}>{todayTotal.toFixed(0)} جنيه</strong>
            </div>
            <div className="muted" style={{ marginTop: 2 }}>لجرد الخزينة اليومي</div>

            {loadingToday && <div style={{ marginTop: 10 }}><SkeletonCards count={2} /></div>}

            {!loadingToday && todayTransactions.length === 0 && (
              <div className="muted" style={{ marginTop: 10 }}>لسه محصّلتش أي مبلغ النهاردة.</div>
            )}

            {!loadingToday && todayTransactions.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {todayTransactions.map((t) => (
                  <div key={t.id} className="row-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{t.students?.name || '—'}</span>
                    <span className="row" style={{ gap: 10 }}>
                      <span className="muted">
                        {new Date(t.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <strong style={{ color: t.amount >= 0 ? '#16a34a' : '#dc2626' }}>
                        {t.amount >= 0 ? '+' : ''}{t.amount}
                      </strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          <input
            placeholder="بحث باسم الطالب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', marginBottom: 4 }}
          />
          <div className="muted" style={{ marginBottom: 10 }}>
            (القائمة تعرض الطلاب اللي لسه عليهم متبقي فقط — لم يدفع أو دفع جزء)
          </div>

          {loading && <SkeletonCards count={4} />}

          {!loading && filtered.length === 0 && rows.length > 0 && (
            <EmptyState title="كل الطلاب دافعين هذا الشهر 🎉" />
          )}

          {!loading && rows.length === 0 && (
            <EmptyState title="لا يوجد طلاب مسجّلين بعد" />
          )}

          {!loading && filtered.map((row) => {
            const p = row.payment;
            const status = p?.status || 'unpaid';
            const hasPhone = !!row.student.parent_phone;
            return (
              <div key={row.student.id} className="card">
                <div className="row-between">
                  <div className="row">
                    <span className="dot" style={{ background: PAYMENT_STATUS_COLORS[status] }} />
                    <strong>{row.student.name}</strong>
                  </div>
                  <div className="row">
                    {status !== 'paid' && hasPhone && (
                      <Button
                        as="a"
                        variant="whatsapp"
                        size="sm"
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
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => startEdit(row)}>دفع</Button>
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
                    <Button size="sm" loading={savingPayment} onClick={() => savePayment(row)}>حفظ</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingStudentId(null)}>إلغاء</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'expenses' && canViewFinancials && (
        <div>
          {loadingExpenses && <SkeletonCards count={3} />}
          {!loadingExpenses && expenses.length === 0 && (
            <EmptyState title="مفيش مصروفات مسجّلة الشهر ده" hint="دوس ➕ عشان تضيف أول بند." />
          )}
          {!loadingExpenses && expenses.map((expense) => (
            <div key={expense.id} className="card">
              <div className="row-between">
                <div>
                  <strong>{expense.title}</strong>
                  <div className="muted" style={{ fontSize: 12.5 }}>{expense.expense_date}</div>
                  {expense.notes && <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{expense.notes}</div>}
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <strong style={{ color: '#b45309', marginLeft: 6 }}>{Number(expense.amount).toFixed(0)} جنيه</strong>
                  <button className="icon-action-btn icon-edit" title="تعديل" onClick={() => startEditExpense(expense)}>
                    <IconPencil size={16} />
                  </button>
                  <button className="icon-action-btn icon-delete" title="حذف" onClick={() => deleteExpense(expense)}>
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button className="fab" onClick={startAddExpense} title="إضافة مصروف جديد">+</button>
        </div>
      )}

      <SlideUpModal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title={editingExpenseId ? 'تعديل مصروف' : 'مصروف جديد'}
      >
        <form onSubmit={saveExpense}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              placeholder="عنوان البند (مثال: إيجار السنتر)"
              value={expenseForm.title}
              onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              autoFocus
              required
            />
            <input
              type="number"
              placeholder="المبلغ (جنيه)"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              required
            />
            <input
              type="date"
              value={expenseForm.expense_date}
              onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
            />
            <textarea
              placeholder="ملاحظات (اختياري)"
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
              rows={2}
              style={{ borderRadius: 12, border: '1.5px solid var(--border)', padding: 10, background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit' }}
            />
            <Button type="submit" loading={savingExpense} style={{ justifyContent: 'center' }}>
              {editingExpenseId ? 'حفظ التعديل' : 'إضافة المصروف'}
            </Button>
          </div>
        </form>
      </SlideUpModal>
    </div>
  );
}
