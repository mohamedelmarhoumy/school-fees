'use client';

import { useState } from 'react';
import { IconSpinner } from './icons';

/**
 * زر موحّد بتأثيرات تفاعلية: ripple عند الضغط، وحالة تحميل (spinner) اختيارية.
 * variant: 'primary' | 'outline' | 'danger' | 'whatsapp'
 */
export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  style = {},
  as = 'button',
  href,
  target,
  rel,
  title,
}) {
  const [ripples, setRipples] = useState([]);

  const spawnRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const id = Date.now();
    setRipples((r) => [...r, { id, x, y, size }]);
    setTimeout(() => {
      setRipples((r) => r.filter((rp) => rp.id !== id));
    }, 550);
  };

  const handleClick = (e) => {
    if (disabled || loading) return;
    spawnRipple(e);
    onClick?.(e);
  };

  const classes = `btn2 btn2-${variant} btn2-${size} ${className}`;

  const content = (
    <>
      {loading && <IconSpinner size={size === 'sm' ? 14 : 16} />}
      <span style={{ opacity: loading ? 0.75 : 1 }}>{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </>
  );

  if (as === 'a') {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        onClick={handleClick}
        className={classes}
        style={style}
        title={title}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={classes}
      style={style}
      title={title}
    >
      {content}
    </button>
  );
}
