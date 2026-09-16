'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import Button from '../../../lib/Button';
import EmptyState from '../../../lib/EmptyState';
import { SkeletonCards } from '../../../lib/Skeleton';

const emptyForm = {
  display_name: '',
  email: '',
  password: '',
  attendance: true,
  payments: true,
  students: true,
  financials: false,
};

export default function AssistantsPage() {
  const { profile, loading: profileLoading, isOwner } = useProfile();
  const [team, setTeam] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState(false);

  const loadTeam = async () => {
    setLoadingTeam(true);
    const { data } = await supabase.from('profiles').select('*').eq('role', 'assistant').order('created_at');
    setTeam(data || []);
    setLoadingTeam(false);
  };

  useEffect(() => {
    if (isOwner) loadTeam();
  }, [isOwner]);

  useEffect(() => {
    if (!successToast) return;
    const t = setTimeout(() => setSuccessToast(false), 3000);
    return () => clearTimeout(t);
  }, [successToast]);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email.trim() || !form.password) {
      setError('الإيميل وكلمة المرور مطلوبين.');
      return;
    }

    setSaving(true);
    const token = await getToken();
    try {
      const res = await fetch('/api/create-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          display_name: form.display_name.trim() || form.email.trim(),
          permissions: {
            attendance: form.attendance,
            payments: form.payments,
            students: form.students,
            financials: form.financials,
          },
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'حصلت مشكلة، حاول تاني.');
        setSaving(false);
        return;
      }
      setForm(emptyForm);
      setSuccessToast(true);
      await loadTeam();
    } catch (err) {
      setError('حصلت مشكلة في الاتصال، حاول تاني.');
    }
    setSaving(false);
  };

  const toggleActive = async (member) => {
    await supabase.from('profiles').update({ is_active: !member.is_active }).eq('id', member.id);
    loadTeam();
  };

  const deleteAssistant = async (member) => {
    if (!confirm(`حذف حساب "${member.display_name || member.email}" نهائياً؟ هيفقد القدرة على الدخول فوراً.`)) return;
    const token = await getToken();
    const res = await fetch('/api/delete-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ assistantId: member.id }),
    });
    if (res.ok) loadTeam();
    else alert('تعذّر حذف الحساب، حاول تاني.');
  };

  if (profileLoading) return <div className="muted">جارِ التحميل...</div>;

  if (!isOwner) {
    return <EmptyState title="غير مصرح لك بالدخول هنا" hint="الصفحة دي للمدرس (صاحب الحساب) بس." />;
  }

  return (
    <div>
      <h2>إدارة المساعدين</h2>

      <form onSubmit={handleSubmit} className="card">
        <h3 style={{ marginTop: 0 }}>إضافة مساعد جديد</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="اسم المساعد"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
          <input
            type="email"
            placeholder="البريد الإلكتروني"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="كلمة المرور"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />

          <div className="muted" style={{ marginTop: 4 }}>الصلاحيات</div>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={form.attendance}
              onChange={(e) => setForm({ ...form, attendance: e.target.checked })}
            />
            تسجيل الحضور والغياب
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={form.payments}
              onChange={(e) => setForm({ ...form, payments: e.target.checked })}
            />
            تحصيل الاشتراكات والرسوم
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={form.students}
              onChange={(e) => setForm({ ...form, students: e.target.checked })}
            />
            إضافة وتعديل بيانات الطلاب
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={form.financials}
              onChange={(e) => setForm({ ...form, financials: e.target.checked })}
            />
            الاطّلاع على التقارير المالية وإجمالي التحصيل
          </label>

          {error && <div className="error-text">{error}</div>}
          <Button type="submit" loading={saving}>إضافة المساعد</Button>
        </div>
      </form>

      <h3>الفريق الحالي</h3>
      {loadingTeam && <SkeletonCards count={2} />}
      {!loadingTeam && team.length === 0 && <EmptyState title="لسه مفيش مساعدين مضافين" />}
      {!loadingTeam &&
        team.map((member) => (
          <div key={member.id} className="card">
            <div className="row-between">
              <div>
                <strong>{member.display_name || member.email}</strong>
                <div className="muted">{member.email}</div>
              </div>
              <span
                className="badge"
                style={{ background: member.is_active ? '#16a34a' : '#6b7280' }}
              >
                {member.is_active ? 'نشط' : 'موقوف'}
              </span>
            </div>
            <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
              {[
                member.can_attendance && 'الحضور',
                member.can_payments && 'الاشتراكات',
                member.can_students && 'الطلاب',
                member.can_view_financials && 'التقارير المالية',
              ]
                .filter(Boolean)
                .join(' • ') || 'مفيش صلاحيات مفعّلة'}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <Button variant="outline" size="sm" onClick={() => toggleActive(member)}>
                {member.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
              </Button>
              <Button variant="danger" size="sm" onClick={() => deleteAssistant(member)}>حذف نهائي</Button>
            </div>
          </div>
        ))}

      {successToast && <div className="success-toast">✓ تم إضافة المساعد بنجاح</div>}
    </div>
  );
}
