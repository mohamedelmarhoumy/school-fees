'use client';

import { useRef, useState } from 'react';
import { IconClose } from './icons';
import Button from './Button';
import { blobToWav } from './audioConvert';
import Portal from './Portal';

export default function SessionSummaryModal({ open, onClose, groupName, dateLabel, students }) {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recording, setRecording] = useState(false);
  const [converting, setConverting] = useState(false);
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
      recorder.onstop = async () => {
        const cleanType = (recorder.mimeType || 'audio/webm').split(';')[0].trim();
        const rawBlob = new Blob(chunksRef.current, { type: cleanType });
        stream.getTracks().forEach((t) => t.stop());

        setConverting(true);
        try {
          // نحوّل الصوت لصيغة WAV القياسية عشان واتساب يقبله كملف صوتي —
          // صيغة التسجيل الأصلية (webm) بيرفضها واتساب رغم إنها صوت سليم.
          const wavBlob = await blobToWav(rawBlob);
          setAudioBlob(wavBlob);
          setAudioUrl(URL.createObjectURL(wavBlob));
        } catch (err) {
          setAudioBlob(rawBlob);
          setAudioUrl(URL.createObjectURL(rawBlob));
          setNotice('تعذّر تحويل الصوت لصيغة متوافقة مع واتساب، هيتبعت بالصيغة الأصلية وممكن ميتقبلش.');
        } finally {
          setConverting(false);
        }
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

  const audioExtension = (type) => {
    if (type.includes('wav')) return 'wav';
    if (type.includes('mp4')) return 'm4a';
    if (type.includes('ogg')) return 'ogg';
    if (type.includes('mpeg')) return 'mp3';
    return 'webm';
  };

  const buildFiles = () => {
    const files = [];
    if (image) files.push(image);
    if (audioBlob) {
      const type = audioBlob.type || 'audio/webm';
      files.push(new File([audioBlob], `voice-note.${audioExtension(type)}`, { type }));
    }
    return files;
  };

  /** يحاول المشاركة المباشرة. لو files اتبعتت صراحة بيستخدمها، وإلا بيبني كل الملفات المتاحة. */
  const shareNow = async (explicitFiles) => {
    setNotice('');
    const files = explicitFiles || buildFiles();

    if (!shareSupported) {
      setNotice('متصفحك مش بيدعم المشاركة المباشرة. جرّب تفتح التطبيق من متصفح الموبايل (Chrome أو Safari حديث).');
      return;
    }

    if (files.length > 0 && shareFilesSupported && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, text: message });
        setNotice('');
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setNotice(
            files.length > 1
              ? 'المشاركة المجمّعة (صورة+صوت) مش شغالة على الجهاز ده. جرّب تبعت كل ملف لوحده من الأزرار تحت.'
              : 'حصلت مشكلة أثناء المشاركة، حاول تاني.'
          );
        }
      }
      return;
    }

    // fallback: مفيش دعم لمشاركة الملفات على الجهاز/المتصفح ده -> شارك النص بس
    try {
      await navigator.share({ text: message });
      if (files.length > 0) {
        setNotice('المتصفح ده مبيدعمش إرفاق الملفات مباشرة، فاتشارك النص بس. جرّب أزرار المشاركة المنفصلة تحت.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') setNotice('حصلت مشكلة أثناء المشاركة، حاول تاني.');
    }
  };

  const currentStudent = studentsWithPhone[queueIndex];

  return (
    <Portal>
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
                <Button variant="outline" size="sm" loading={converting} disabled={converting} onClick={startRecording}>
                  {converting ? 'جارِ تجهيز الصوت...' : '🎙️ ابدأ التسجيل'}
                </Button>
              ) : (
                <Button variant="danger" size="sm" onClick={stopRecording}>⏹ وقف التسجيل</Button>
              )}
              {audioUrl && !converting && <audio src={audioUrl} controls style={{ height: 32 }} />}
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
              <Button onClick={() => shareNow()}>شارك دلوقتي (الكل مع بعض)</Button>
              <Button variant="outline" onClick={() => setMode(null)}>رجوع</Button>
            </div>
            {image && audioBlob && (
              <div className="row" style={{ marginTop: 8 }}>
                <Button variant="outline" size="sm" onClick={() => shareNow([image])}>شارك الصورة فقط</Button>
                <Button variant="outline" size="sm" onClick={() => shareNow(buildFiles().filter((f) => f !== image))}>
                  شارك الصوت فقط
                </Button>
              </div>
            )}
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
                  <Button onClick={() => shareNow()}>شارك مع ولي الأمر (الكل مع بعض)</Button>
                  <Button
                    variant="outline"
                    onClick={() => setQueueIndex((i) => Math.min(i + 1, studentsWithPhone.length))}
                  >
                    التالي
                  </Button>
                </div>
                {image && audioBlob && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <Button variant="outline" size="sm" onClick={() => shareNow([image])}>شارك الصورة فقط</Button>
                    <Button variant="outline" size="sm" onClick={() => shareNow(buildFiles().filter((f) => f !== image))}>
                      شارك الصوت فقط
                    </Button>
                  </div>
                )}
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
    </Portal>
  );
}
