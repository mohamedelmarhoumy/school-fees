'use client';

import { useEffect } from 'react';
import ErrorCard from '../lib/ErrorCard';

export default function RootSegmentError({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('حصل خطأ عام في التطبيق:', error);
  }, [error]);

  return <ErrorCard title="حصلت مشكلة غير متوقعة" onRetry={reset} />;
}
