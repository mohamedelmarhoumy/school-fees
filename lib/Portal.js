'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * بيرندر المحتوى مباشرة تحت <body> بدل ما يفضل جوه شجرة الصفحة.
 * ده بيضمن إن أي نافذة منبثقة (Modal) متفضلش عالقة تحت أي عنصر تاني
 * (زي الشريط السفلي) بغض النظر عن أي تأثيرات CSS في الصفحة نفسها.
 */
export default function Portal({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
