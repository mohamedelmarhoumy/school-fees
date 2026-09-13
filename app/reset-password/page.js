'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../lib/Button';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // رابط الاستعادة بييجي بيه جلسة دخول مؤقتة (recovery session) تلقائياً
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(!!session);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

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
      setError('حصلت مشكلة أثناء تحديث كلمة المرور، الرابط ممكن يكون منتهي. جرّب تطلب رابط جديد.');
      return;
    }
    setDone(true);
  };

  if (!ready) {
    return <div className="center-screen">جارِ التحميل...</div>;
  }

  return (
    <div className="center-screen">
      <div className="card" style={{ width: 320 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
          <img src="/icons/icon-192.png" alt="حصتي" style={{ width: 64, height: 64, borderRadius: 16 }} />
          <h2 style={{ margin: '10px 0 0' }}>حصتي</h2>
          <div className="muted">تحديد كلمة مرور جديدة</div>
        </div>

        {!hasSession && (
          <div style={{ textAlign: 'center' }}>
            <div className="error-text">الرابط ده منتهي أو مش صالح.</div>
            <button
              type="button"
              className="btn2 btn2-outline btn2-sm"
              style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              onClick={() => router.replace('/login')}
            >
              رجوع لتسجيل الدخول
            </button>
          </div>
        )}

        {hasSession && !done && (
          <form onSubmit={handleSubmit}>
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
              <Button type="submit" loading={saving} style={{ width: '100%', justifyContent: 'center' }}>
                حفظ كلمة المرور
              </Button>
            </div>
          </form>
        )}

        {hasSession && done && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>✓ تم تحديث كلمة المرور بنجاح</div>
            <Button style={{ width: '100%', justifyContent: 'center' }} onClick={() => router.replace('/dashboard')}>
              الدخول للتطبيق
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
