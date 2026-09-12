const CACHE_NAME = 'school-app-shell-v4';
const APP_SHELL = ['/manifest.json', '/favicon.ico', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png', '/icons/logo-header.png'];

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

  // صفحة الـ HTML نفسها (التنقل بين الشاشات): شبكة أولاً دايماً، عشان أي تحديث
  // (زي تغيير الألوان أو الخط) يظهر فوراً من أول فتح، مش نسخة قديمة مخزّنة.
  // الكاش بيتستخدم بس لو مفيش إنترنت خالص.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // باقي الملفات الثابتة (أيقونات، manifest): كاش أولاً مع تحديث في الخلفية
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
