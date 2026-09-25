'use client';

import { SWRConfig } from 'swr';
import { localStorageCacheProvider } from './swrPersist';

export default function AppProviders({ children }) {
  return (
    <SWRConfig
      value={{
        provider: localStorageCacheProvider,
        revalidateOnFocus: false, // مش محتاجين نطلب النت تاني كل ما التطبيق يرجع فوكس، عشان نوفر النت الضعيف
        revalidateIfStale: true, // لكن لما نفتح شاشة نبعت طلب تحديث هادئ في الخلفية
        revalidateOnReconnect: true, // أهم حاجة: أول ما النت يرجع، حدّث كل حاجة قديمة أوتوماتيك
        dedupingInterval: 4000,
        errorRetryCount: 3,
        errorRetryInterval: 3000,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
