'use client';

import { useRef, useState } from 'react';
import { IconClose } from './icons';
import Button from './Button';

export default function SessionSummaryModal({ open, onClose, groupName, dateLabel, students }) {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState(`ملخص حصة اليوم — مجموعة ${groupName} (${dateLabel})`);
  const [mode, setMode] = useState(null); // null | 'individual' | 'group'
  const [queueIndex, setQueueIndex] = useState(0);
  const [notice, setNotice] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const studentsWithPhone = (students || []).filter((s) => s.parent_phone);
  const shareFilesSupported = typeof navigator !== 'undefined' && !!navigator.canShare;
  const shareSupported = typeof navigator !== 'undefined' && !!navigator.share;

  if (!open) return null;

  const resetMedia = () => {
    setImage(null);
    setImagePreview(null);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const handleClose = () => {
    resetMedia();
    setMode(null);
    setQueueIndex(0);
    setNotice('');
    onClose();
  };

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const startRecording = async () => {
    setNotice('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      setNotice('محتاج إذن الميكروفون عشان تسجّل صوت.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const buildFiles = () => {
    const files = [];
    if (image) files.push(image);
    if (audioBlob) files.push(new File([audioBlob], 'voice-note.webm', { type: audioBlob.type || 'audio/webm' }));
    return files;
  };

  /** يحاول المشاركة المباشرة (صورة+صوت+نص). لو المتصفح مايدعمش الملفات، يرجع للنص بس كحل بديل. */
  const shareNow = async () => {
    setNotice('');
    const files = buildFiles();

    if (!shareSupported) {
      setNotice('متصفحك مش بيدعم المشاركة المباشرة. جرّب تفتح التطبيق من متصفح الموبايل (Chrome أو Safari حديث).');
      return;
    }

    if (files.length > 0 && shareFilesSupported && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, text: message });
      } catch (err) {
        if (err?.name !== 'AbortError') setNotice('حصلت مشكلة أثناء المشاركة، حاول تاني.');
      }
      return;
    }

    // fallback: مفيش دعم لمشاركة الملفات على الجهاز/المتصفح ده -> شارك النص بس
    try {
      await navigator.share({ text: message });
      if (files.length > 0) {
        setNotice('المتصفح ده مبيدعمش إرفاق الصورة/الصوت مباشرة، فاتشارك النص بس. تقدر ترفق الصورة والصوت يدوي في واتساب.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') setNotice('حصلت مشكلة أثناء المشاركة، حاول تاني.');
    }
  };

  const currentStudent = studentsWithPhone[queueIndex];

  return (
    <div className="search-overlay" onClick={handleClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>إعداد ملخص الحصة</strong>
          <button className="icon-btn" onClick={handleClose}><IconClose size={15} /></button>
        </div>
        <div className="muted" style={{ marginTop: 2 }}>{groupName} — {dateLabel}</div>

        {mode === null && (
          <div style={{ marginTop: 14 }}>
            <div className="muted" style={{ marginBottom: 6 }}>صورة السبورة</div>
            <label className="btn2 btn2-outline btn2-sm" style={{ display: 'inline-flex', cursor: 'pointer' }}>
              {image ? 'تغيير الصورة' : 'التقاط / رفع صورة'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImagePick}
                style={{ display: 'none' }}
              />
            </label>
            {imagePreview && (
              <img src={imagePreview} alt="معاينة" style={{ width: '100%', borderRadius: 12, marginTop: 8, maxHeight: 180, objectFit: 'cover' }} />
            )}

            <div className="muted" style={{ marginTop: 14, marginBottom: 6 }}>تسجيل صوتي سريع</div>
            <div className="row">
              {!recording ? (
                <Button variant="outline" size="sm" onClick={startRecording}>🎙️ ابدأ التسجيل</Button>
              ) : (
                <Button variant="danger" size="sm" onClick={stopRecording}>⏹ وقف التسجيل</Button>
              )}
              {audioUrl && <audio src={audioUrl} controls style={{ height: 32 }} />}
            </div>

            <div className="muted" style={{ marginTop: 14, marginBottom: 6 }}>نص الرسالة</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              style={{ width: '100%', borderRadius: 12, border: '1.5px solid var(--border)', padding: 10, background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit' }}
            />

            {notice && <div className="error-text" style={{ marginTop: 8 }}>{notice}</div>}

            <div className="row" style={{ marginTop: 14 }}>
              <Button
                variant="primary"
                size="sm"
                disabled={studentsWithPhone.length === 0}
                onClick={() => { setMode('individual'); setQueueIndex(0); }}
              >
                إرسال فردي متتالي لكل ولي أمر
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMode('group')}>
                مشاركة على جروب المجموعة
              </Button>
            </div>
            {studentsWithPhone.length === 0 && (
              <div className="muted" style={{ marginTop: 6 }}>مفيش أرقام أولياء أمور مسجّلة لطلاب المجموعة دي.</div>
            )}
          </div>
        )}

        {mode === 'group' && (
          <div style={{ marginTop: 14 }}>
            <div className="muted">هيفتح لك مشاركة واتساب — اختار جروب المجموعة من القائمة.</div>
            {notice && <div className="error-text" style={{ marginTop: 8 }}>{notice}</div>}
            <div className="row" style={{ marginTop: 12 }}>
              <Button onClick={shareNow}>شارك دلوقتي</Button>
              <Button variant="outline" onClick={() => setMode(null)}>رجوع</Button>
            </div>
          </div>
        )}

        {mode === 'individual' && (
          <div style={{ marginTop: 14 }}>
            {currentStudent ? (
              <>
                <div className="muted">
                  {queueIndex + 1} من {studentsWithPhone.length}
                </div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{currentStudent.name}</div>
                <div className="muted">{currentStudent.parent_phone}</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  هيفتح مشاركة واتساب — اختار محادثة ولي الأمر ده بنفسك من القائمة.
                </div>
                {notice && <div className="error-text" style={{ marginTop: 8 }}>{notice}</div>}
                <div className="row" style={{ marginTop: 12 }}>
                  <Button onClick={shareNow}>شارك مع ولي الأمر</Button>
                  <Button
                    variant="outline"
                    onClick={() => setQueueIndex((i) => Math.min(i + 1, studentsWithPhone.length))}
                  >
                    التالي
                  </Button>
                </div>
              </>
            ) : (
              <div>
                <div className="muted">خلصت كل أولياء الأمور 🎉</div>
                <Button variant="outline" size="sm" style={{ marginTop: 10 }} onClick={() => setMode(null)}>رجوع</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
