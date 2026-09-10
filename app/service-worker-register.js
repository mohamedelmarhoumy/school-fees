'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // تجاهل أي خطأ في التسجيل — التطبيق يعمل بشكل طبيعي حتى بدون service worker
      });
    }
  }, []);

  return null;
}
