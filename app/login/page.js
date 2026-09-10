'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

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
        <h2 style={{ textAlign: 'center', marginTop: 0 }}>تسجيل الدخول</h2>
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
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'جارِ الدخول...' : 'دخول'}
          </button>
        </div>
      </form>
    </div>
  );
}
