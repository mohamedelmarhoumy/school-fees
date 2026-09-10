/** يبني رابط واتساب مباشر (wa.me) برسالة جاهزة. */
export function buildWhatsAppLink(phone, message) {
  const digitsOnly = (phone || '').replace(/[^0-9]/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${digitsOnly}?text=${encodedMessage}`;
}
