'use client';

import { useRef, useState } from 'react';
import { buildWhatsAppLink } from './whatsapp';
import Button from './Button';
import { IconClose } from './icons';

const VARIABLES = [
  { token: '{اسم_الطالب}', label: 'اسم الطالب' },
  { token: '{اسم_المجموعة}', label: 'اسم المجموعة' },
  { token: '{اسم_الصف}', label: 'اسم الصف' },
];

function applyTemplate(template, recipient) {
  return template
    .split('{اسم_الطالب}').join(recipient.name || '')
    .split('{اسم_المجموعة}').join(recipient.groupName || '')
    .split('{اسم_الصف}').join(recipient.gradeName || '');
}

export default function BulkWhatsAppModal({ open, onClose, recipients, title }) {
  const [message, setMessage] = useState('');
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const textareaRef = useRef(null);

  if (!open) return null;

  const withPhone = (recipients || []).filter((r) => r.phone);
  const skippedCount = (recipients || []).length - withPhone.length;

  const insertVariable = (token) => {
    const el = textareaRef.current;
    if (!el) {
      setMessage((m) => m + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const handleClose = () => {
    setMessage('');
    setStarted(false);
    setIndex(0);
    onClose();
  };

  const current = withPhone[index];

  return (
    <div className="search-overlay" onClick={handleClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>رسالة جماعية — {title}</strong>
          <button className="icon-btn" onClick={handleClose}><IconClose size={15} /></button>
        </div>

        {!started && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              متغيرات ذكية (دوس تضيفها لمكان الكتابة):
            </div>
            <div className="row" style={{ marginBottom: 10 }}>
              {VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  className="btn2 btn2-outline btn2-sm"
                  onClick={() => insertVariable(v.token)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="مثال: أهلاً {اسم_الطالب}، تذكير بموعد حصة {اسم_المجموعة} بكرة الساعة ٥..."
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1.5px solid var(--border)',
                padding: 10,
                background: 'var(--input-bg)',
                color: 'var(--text)',
                fontFamily: 'inherit',
              }}
            />
            <div className="muted" style={{ marginTop: 8 }}>
              عدد المستقبلين: {withPhone.length}
              {skippedCount > 0 && <> (و{skippedCount} من غير رقم واتساب مسجّل، مش هيتبعتلهم)</>}
            </div>
            <Button
              style={{ marginTop: 10 }}
              disabled={!message.trim() || withPhone.length === 0}
              onClick={() => {
                setStarted(true);
                setIndex(0);
              }}
            >
              بدء الإرسال
            </Button>
          </div>
        )}

        {started && current && (
          <div style={{ marginTop: 12 }}>
            <div className="muted">{index + 1} من {withPhone.length}</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{current.name}</div>
            <div className="muted">{current.phone}</div>
            <div className="card" style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 13.5 }}>
              {applyTemplate(message, current)}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <Button
                as="a"
                variant="whatsapp"
                href={buildWhatsAppLink(current.phone, applyTemplate(message, current))}
                target="_blank"
                rel="noreferrer"
                onClick={() => setIndex((i) => i + 1)}
              >
                إرسال التالي (فتح واتساب)
              </Button>
              <Button variant="outline" onClick={() => setIndex((i) => i + 1)}>
                تخطي
              </Button>
            </div>
            <button
              type="button"
              className="btn2 btn2-outline btn2-sm"
              style={{ marginTop: 8 }}
              onClick={() => setStarted(false)}
            >
              رجوع لتعديل الرسالة
            </button>
          </div>
        )}

        {started && !current && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <div>✓ خلصت كل المستقبلين ({withPhone.length})</div>
            <Button variant="outline" size="sm" style={{ marginTop: 10 }} onClick={handleClose}>إغلاق</Button>
          </div>
        )}
      </div>
    </div>
  );
}
