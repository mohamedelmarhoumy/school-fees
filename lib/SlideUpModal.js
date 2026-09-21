'use client';

import { IconClose } from './icons';

export default function SlideUpModal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div className="slideup-overlay" onClick={onClose}>
      <div className="slideup-panel" onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <strong>{title}</strong>
          <button className="icon-btn" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
