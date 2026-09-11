/**
 * يطبّع رقم الهاتف المصري المحلي لصيغة دولية يقبلها واتساب:
 * - لو الرقم يبدأ بصفر (مثال: 01012345678) -> يشيل الصفر ويضيف كود مصر 20 (201012345678)
 * - لو الرقم متسجل من غير الصفر بالفعل (1012345678 - 10 أرقام) -> يضيف 20 في الأول
 * - لو الرقم متسجل بكود الدولة أصلاً (201012345678) -> يسيبه زي ما هو
 */
export function normalizeEgyptPhone(rawPhone) {
  const digitsOnly = (rawPhone || '').replace(/[^0-9]/g, '');
  if (!digitsOnly) return '';

  if (digitsOnly.startsWith('20')) return digitsOnly;
  if (digitsOnly.startsWith('0')) return '20' + digitsOnly.slice(1);
  if (digitsOnly.length === 10 && digitsOnly.startsWith('1')) return '20' + digitsOnly;
  return digitsOnly;
}

/** يبني رابط واتساب مباشر (wa.me) برسالة جاهزة، بعد تطبيع الرقم لصيغة دولية. */
export function buildWhatsAppLink(phone, message) {
  const normalized = normalizeEgyptPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encodedMessage}`;
}
