'use client';

import { useEffect, useRef } from 'react';
import { IconClose } from './icons';
import Portal from './Portal';

export default function SlideUpModal({ open, onClose, title, children }) {
  const panelRef = useRef(null);

  // لما أي حقل جوه النافذة ياخد فوكس، نتأكد إنه يظهر فوق الكيبورد
  // (focusin بتعمل bubble بعكس focus، فبنسمعها مرة واحدة على النافذة كلها)
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const handler = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        setTimeout(() => {
          e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 300);
      }
    };
    panel.addEventListener('focusin', handler);
    return () => panel.removeEventListener('focusin', handler);
  }, [open]);

  if (!open) return null;

  return (
    <Portal>
      <div className="slideup-overlay" onClick={onClose}>
        <div className="slideup-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <strong>{title}</strong>
            <button className="icon-btn" onClick={onClose}>
              <IconClose size={16} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}
