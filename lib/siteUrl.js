/**
 * الدومين الرسمي للتطبيق — بيُستخدم في رابط كود الـ QR المطبوع على كارت
 * الطالب. لازم يتحدد بمتغيّر بيئة ثابت NEXT_PUBLIC_SITE_URL عشان الكارت
 * المطبوع يفضل شغال دايماً، حتى لو المدرس طبعه وهو داخل من لوكال هوست أو
 * رابط معاينة مؤقت من Vercel. لو المتغيّر مش متحدد، بيرجع لعنوان المتصفح
 * الحالي كحل بديل مؤقت (مناسب للتجربة بس مش للطباعة الفعلية).
 */
export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
