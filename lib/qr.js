import QRCode from 'qrcode';

/**
 * القيمة المشفّرة جوه كود الـ QR الخاص بكل طالب — بقت رابط كامل لصفحة متابعة
 * ولي الأمر العامة (/p/[parent_token])، مش نص داخلي زي قبل كده. كده الكود
 * بيخدم غرضين في نفس الوقت:
 *  - كاميرا موبايل عادية (ولي الأمر/الطالب): بتفتح الرابط على طول في
 *    المتصفح وتوريه الحضور والمدفوعات والدرجات لحظة بلحظة.
 *  - ماسح التطبيق (jsQR): بيقرا نفس الرابط ويستخرج منه توكن الطالب
 *    (parseStudentQrValue) عشان يسجّل حضوره فوراً من غير ما يفتح أي حاجة.
 */
export function studentQrValue(origin, parentToken) {
  return `${origin}/p/${parentToken}`;
}

/**
 * يستخرج توكن الطالب من نص QR ممسوح، ويرجّع { kind, value } أو null لو
 * الكود مش تابع للتطبيق. بيدعم صيغتين:
 *  - الحالية: رابط كامل زي https://.../p/<token>  → { kind: 'token', value: token }
 *  - القديمة: STU:<student_id> (كروت اتطبعت قبل تفعيل الرابط العام) → { kind: 'id', value: id }
 */
export function parseStudentQrValue(text) {
  if (!text) return null;
  const trimmed = text.trim();

  if (trimmed.startsWith('STU:')) {
    const id = trimmed.slice(4).trim();
    return id ? { kind: 'id', value: id } : null;
  }

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const pIndex = parts.indexOf('p');
    if (pIndex !== -1 && parts[pIndex + 1]) {
      return { kind: 'token', value: parts[pIndex + 1] };
    }
  } catch {
    // مش رابط صالح — نتجاهله
  }
  return null;
}

/** بيولّد صورة QR (Data URL) لطالب معيّن، جاهزة للعرض أو الطباعة */
export async function studentQrDataUrl(origin, parentToken, size = 220) {
  return QRCode.toDataURL(studentQrValue(origin, parentToken), {
    width: size,
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' },
  });
}
