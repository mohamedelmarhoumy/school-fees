'use client';

import { useEffect, useRef, useState } from 'react';
import { IconKebab } from './icons';

/**
 * زر ⋮ (ثلاث نقاط) بيفتح قائمة صغيرة تحت — بديل أنيق لعرض كذا زر إجراء
 * جنب بعض. بتتقفل لوحدها لو ضغطت بره القائمة أو اخترت عنصر منها.
 * items: [{ icon, label, onClick, danger? }]
 */
export default function KebabMenu({ items, title = 'خيارات المزيد', align = 'start' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open]);

  return (
    <div className="kebab-menu" ref={wrapRef}>
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)} title={title}>
        <IconKebab size={18} />
      </button>
      {open && (
        <div className={`kebab-dropdown kebab-dropdown-${align}`}>
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              className={`kebab-item ${item.danger ? 'kebab-item-danger' : ''}`}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
            >
              <span className="kebab-item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
