const CACHE_NAME = 'school-app-shell-v5';
const APP_SHELL = ['/manifest.json', '/favicon.ico', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png', '/icons/logo-header.png'];
const NAV_TIMEOUT_MS = 1500; // أقصى وقت ننتظره من شبكة ضعيفة قبل ما نستخدم النسخة المخزّنة فوراً

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // لا نتدخل أبداً في طلبات البيانات (Supabase) — لازم تروح للشبكة دايماً
  if (url.origin.includes('supabase.co') || event.request.method !== 'GET') {
    return;
  }

  // صفحة الـ HTML نفسها (أول تحميل أو Refresh كامل): بنحاول الشبكة، لكن لو
  // في نسخة مخزّنة من قبل ومفيش رد خلال وقت قصير (نت ضعيف جداً)، بنعرض
  // النسخة المخزّنة فوراً عشان الشاشة تفتح بسرعة بدل ما تفضل بيضاء تستنى.
  // لو الشبكة ردّت بعد كده بردو بنحدّث الكاش بهدوء للمرة الجاية.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request).then((r) => r || caches.match('/'));
        const networkPromise = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => null);

        if (!cached) {
          // مفيش أي نسخة مخزّنة خالص — لازم نستنى الشبكة مهما طالت
          const networkResponse = await networkPromise;
          return networkResponse || new Response('تعذّر تحميل الصفحة — تأكد من الاتصال بالإنترنت.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }

        // فيه نسخة مخزّنة: سباق بين الشبكة ومهلة قصيرة — أول واحد يوصل يكسب
        const timeoutFallback = new Promise((resolve) => setTimeout(() => resolve(cached), NAV_TIMEOUT_MS));
        const networkOrCache = networkPromise.then((r) => r || cached);
        return Promise.race([networkOrCache, timeoutFallback]);
      })()
    );
    return;
  }

  // باقي الملفات الثابتة (JS/CSS مبنية، خطوط، أيقونات): كاش أولاً فوراً مع
  // تحديث هادئ في الخلفية — أسرع طريقة ممكنة، ومناسبة لأن أسماء الملفات دي
  // بيتغير الـ hash بتاعها مع كل نسخة جديدة من التطبيق.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
