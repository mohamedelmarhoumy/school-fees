'use client';

/** كارت موحّد لعرض حالة الخطأ بدل شاشة "Application error" العامة بتاعة Next.js */
export default function ErrorCard({ title = 'حصلت مشكلة غير متوقعة', message, onRetry, homeHref = '/dashboard' }) {
  return (
    <div className="center-screen" style={{ flexDirection: 'column', gap: 12, textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: 38 }}>⚠️</div>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p className="muted" style={{ maxWidth: 320, margin: 0 }}>
        {message || 'الشاشة واجهت خطأ ومش قادرة تفتح دلوقتي. جرّب تاني، ولو المشكلة استمرت ارجع للرئيسية.'}
      </p>
      <div className="row" style={{ gap: 8 }}>
        {onRetry && (
          <button className="btn2 btn2-primary btn2-sm" onClick={onRetry}>
            🔄 إعادة المحاولة
          </button>
        )}
        <a className="btn2 btn2-outline btn2-sm" href={homeHref}>
          🏠 الرجوع للرئيسية
        </a>
      </div>
    </div>
  );
}
