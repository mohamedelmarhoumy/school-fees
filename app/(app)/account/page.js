'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import Button from '../../../lib/Button';
import { useProfile } from '../../../lib/useProfile';
import { downloadJson } from '../../../lib/exportJson';

export default function AccountPage() {
  const { isOwner } = useProfile();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email || '');
    });
  }, []);

  useEffect(() => {
    if (!successToast) return;
    const t = setTimeout(() => setSuccessToast(false), 3500);
    return () => clearTimeout(t);
  }, [successToast]);

  const handleBackup = async () => {
    setBackingUp(true);
    const [grades, groups, students, payments, attendance, transactions] = await Promise.all([
      supabase.from('grades').select('*'),
      supabase.from('groups_table').select('*'),
      supabase.from('students').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('attendance').select('*'),
      supabase.from('payment_transactions').select('*'),
    ]);

    downloadJson(`نسخة-احتياطية-حصتي-${new Date().toISOString().slice(0, 10)}.json`, {
      exported_at: new Date().toISOString(),
      grades: grades.data || [],
      groups: groups.data || [],
      students: students.data || [],
      payments: payments.data || [],
      attendance: attendance.data || [],
      payment_transactions: transactions.data || [],
    });
    setBackingUp(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('كلمة المرور لازم تكون 6 حروف/أرقام على الأقل.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور وتأكيدها مش متطابقين.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (updateError) {
      setError('حصلت مشكلة أثناء تحديث كلمة المرور، حاول تاني.');
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setSuccessToast(true);
  };

  return (
    <div>
      <h2>إعدادات الحساب</h2>

      <div className="card">
        <div className="muted">البريد الإلكتروني</div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>{email || '—'}</div>
      </div>

      {isOwner && (
        <Link href="/assistants" className="card row-between" style={{ display: 'flex' }}>
          <span>👥 إدارة المساعدين</span>
          <span className="muted">←</span>
        </Link>
      )}

      {isOwner && (
        <Link href="/activity" className="card row-between" style={{ display: 'flex' }}>
          <span>📋 سجل النشاط</span>
          <span className="muted">←</span>
        </Link>
      )}

      {isOwner && (
        <div className="card">
          <div className="row-between">
            <div>
              <strong>💾 نسخة احتياطية شاملة</strong>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                كل بياناتك (صفوف، طلاب، اشتراكات، حضور) في ملف واحد تحتفظ بيه براحتك
              </div>
            </div>
            <Button variant="outline" size="sm" loading={backingUp} onClick={handleBackup}>تنزيل</Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <h3 style={{ marginTop: 0 }}>تغيير كلمة المرور</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password"
            placeholder="كلمة المرور الجديدة"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="تأكيد كلمة المرور الجديدة"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {error && <div className="error-text">{error}</div>}
          <Button type="submit" loading={saving}>تحديث كلمة المرور</Button>
        </div>
      </form>

      {successToast && (
        <div className="success-toast">✓ تم تحديث كلمة المرور بنجاح</div>
      )}
    </div>
  );
}
