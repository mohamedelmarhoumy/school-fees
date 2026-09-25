'use client';

const STORAGE_KEY = 'hissati-swr-cache-v1';
const MAX_ENTRIES = 60; // سقف بسيط عشان الكاش ميكبرش من غير حدود

/**
 * Provider بيخلي SWR يحتفظ بآخر نسخة من كل استعلام في localStorage.
 * ده هو اللي بيخلي الشاشة تفتح فوراً بالبيانات القديمة (Stale) قبل حتى
 * ما نطلب النت، بدل ما تفضل شاشة بيضاء أو Skeleton لحد ما يوصل رد السيرفر.
 * مبني على نفس الطريقة الموصى بيها في docs الرسمية بتاعة SWR.
 */
export function localStorageCacheProvider() {
  let map;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    map = new Map(raw ? JSON.parse(raw) : []);
  } catch {
    map = new Map();
  }

  const persist = () => {
    try {
      const entries = Array.from(map.entries()).slice(-MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // لو الكاش امتلأ أو المتصفح رفض الكتابة، نتجاهل بهدوء — مش حرج
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', persist);
    // كمان نحفظ كل شوية ثواني عشان لو حصل قفل مفاجئ للتطبيق (شائع على موبايل)
    setInterval(persist, 8000);
  }

  return map;
}
