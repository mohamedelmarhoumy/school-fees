'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../lib/Button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      return;
    }
    router.replace('/dashboard');
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSending(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
    });
    setResetSending(false);
    if (resetErr) {
      setResetError('حصلت مشكلة أثناء إرسال رابط الاستعادة، حاول تاني.');
      return;
    }
    setResetSent(true);
  };

  return (
    <div className="center-screen">
      <div className="card" style={{ width: 320 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
          <img src="/icons/icon-192.png" alt="حصتي" style={{ width: 64, height: 64, borderRadius: 16 }} />
          <h2 style={{ margin: '10px 0 0' }}>حصتي</h2>
          <div className="muted">{forgotMode ? 'استعادة كلمة المرور' : 'تسجيل الدخول'}</div>
        </div>

        {!forgotMode ? (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <div className="error-text">{error}</div>}
              <Button type="submit" loading={loading} style={{ width: '100%', justifyContent: 'center' }}>
                دخول
              </Button>
              <button
                type="button"
                className="btn2 btn2-outline btn2-sm"
                style={{ width: '100%', justifyContent: 'center', marginTop: 2 }}
                onClick={() => {
                  setForgotMode(true);
                  setResetEmail(email);
                  setResetSent(false);
                  setResetError('');
                }}
              >
                نسيت كلمة المرور؟
              </button>
            </div>
          </form>
        ) : (
          <div>
            {!resetSent ? (
              <form onSubmit={handleReset}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="muted">هنبعتلك رابط على بريدك الإلكتروني لاستعادة الحساب.</div>
                  <input
                    type="email"
                    placeholder="البريد الإلكتروني"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                  {resetError && <div className="error-text">{resetError}</div>}
                  <Button type="submit" loading={resetSending} style={{ width: '100%', justifyContent: 'center' }}>
                    إرسال رابط الاستعادة
                  </Button>
                  <button
                    type="button"
                    className="btn2 btn2-outline btn2-sm"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 2 }}
                    onClick={() => setForgotMode(false)}
                  >
                    رجوع لتسجيل الدخول
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center' }}>
                <div>✓ تم إرسال رابط الاستعادة على بريدك الإلكتروني.</div>
                <div className="muted">افتح الرابط من جهازك، هيوصّلك لصفحة تحديد كلمة مرور جديدة.</div>
                <button
                  type="button"
                  className="btn2 btn2-outline btn2-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setForgotMode(false)}
                >
                  رجوع لتسجيل الدخول
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
