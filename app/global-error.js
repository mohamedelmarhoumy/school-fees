'use client';

import './globals.css';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
            textAlign: 'center',
            padding: 24,
            fontFamily: 'Tajawal, Tahoma, Arial, sans-serif',
          }}
        >
          <div style={{ fontSize: 38 }}>⚠️</div>
          <h3 style={{ margin: 0 }}>التطبيق واجه مشكلة غير متوقعة</h3>
          <p style={{ maxWidth: 320, color: '#6b7280', margin: 0 }}>
            جرّب تحديث الصفحة. لو المشكلة استمرت، تواصل مع الدعم الفني.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            🔄 إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
