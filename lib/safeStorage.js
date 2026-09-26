/**
 * بعض المتصفحات (خاصة الـ WebView بتاعة واتساب/فيسبوك/إنستجرام، أو وضع
 * التصفح الخاص) بتمنع الوصول لـ localStorage تماماً وبترمي Exception حقيقي
 * لمجرد ما تحاول تقرا أو تكتب — مش مجرد ترجع فاضية. من غير الغلاف ده، أي
 * قراءة/كتابة زي دي ممكن توقف رندر الصفحة كلها لو حصلت جوه useEffect.
 */
export function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
