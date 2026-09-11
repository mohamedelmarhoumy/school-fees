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

  return (
    <div className="center-screen">
      <form onSubmit={handleSubmit} className="card" style={{ width: 320 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
          <img src="/icons/icon-192.png" alt="حصتي" style={{ width: 64, height: 64, borderRadius: 16 }} />
          <h2 style={{ margin: '10px 0 0' }}>حصتي</h2>
          <div className="muted">تسجيل الدخول</div>
        </div>
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
        </div>
      </form>
    </div>
  );
}
