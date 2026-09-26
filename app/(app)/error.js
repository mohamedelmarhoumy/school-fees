'use client';

import { useEffect } from 'react';
import ErrorCard from '../../lib/ErrorCard';

export default function AppSegmentError({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('حصل خطأ في إحدى شاشات التطبيق:', error);
  }, [error]);

  return (
    <ErrorCard
      title="الشاشة دي واجهت مشكلة"
      message="حصل خطأ غير متوقع أثناء تحميل الشاشة. جرّب تاني، ولو المشكلة استمرت ارجع للرئيسية."
      onRetry={reset}
    />
  );
}
