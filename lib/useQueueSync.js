'use client';

import { useCallback, useEffect, useState } from 'react';
import { getQueueCount, flushQueue, subscribeQueueChanges } from './offlineQueue';

/** بيفضل يحاول يفرّغ طابور عمليات معلّقة (اللي اتسجلت أوبتيمستك بس فشلت ترفع)
 * تلقائياً: أول ما الشاشة تتفتح، أول ما النت يرجع، وكل فترة كمان كاحتياط. */
export function useQueueSync(queueName, handler, { intervalMs = 6000 } = {}) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setPendingCount(getQueueCount(queueName));
    return subscribeQueueChanges((name) => {
      if (name === queueName) setPendingCount(getQueueCount(queueName));
    });
  }, [queueName]);

  const flushNow = useCallback(async () => {
    if (getQueueCount(queueName) === 0) return;
    await flushQueue(queueName, handler);
  }, [queueName, handler]);

  useEffect(() => {
    flushNow();
    window.addEventListener('online', flushNow);
    const interval = setInterval(flushNow, intervalMs);
    return () => {
      window.removeEventListener('online', flushNow);
      clearInterval(interval);
    };
  }, [flushNow, intervalMs]);

  return { pendingCount, flushNow };
}
