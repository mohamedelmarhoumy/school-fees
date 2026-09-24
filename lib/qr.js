import QRCode from 'qrcode';

/**
 * القيمة اللي بتتشفّر جوه كود الـ QR الخاص بكل طالب.
 * مبنية على الـ id الفريد بتاع الطالب في قاعدة البيانات (متولّد تلقائياً وقت الإضافة)،
 * مع بادئة (STU:) عشان لو الماسح شاف أي QR تاني في الدنيا يقدر يتجاهله بسهولة.
 */
export function studentQrValue(studentId) {
  return `STU:${studentId}`;
}

/** يستخرج الـ id بتاع الطالب من نص QR ممسوح، أو null لو الكود مش خاص بالتطبيق */
export function parseStudentQrValue(text) {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('STU:')) return null;
  const id = trimmed.slice(4).trim();
  return id || null;
}

/** بيولّد صورة QR (Data URL) لطالب معيّن، جاهزة للعرض أو الطباعة */
export async function studentQrDataUrl(studentId, size = 220) {
  return QRCode.toDataURL(studentQrValue(studentId), {
    width: size,
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' },
  });
}
