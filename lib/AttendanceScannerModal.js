'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import Portal from './Portal';
import { IconClose } from './icons';
import { supabase } from './supabaseClient';
import { parseStudentQrValue } from './qr';
import { logActivity } from './activityLog';

const RESCAN_COOLDOWN_MS = 4000; // منع تسجيل نفس الطالب تاني خلال ثواني من مسحه
const RESULT_VISIBLE_MS = 2200; // مدة ظهور نتيجة كل مسح على الشاشة قبل الرجوع للمسح

function playBeep(success = true) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = success ? 880 : 300;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.16 : 0.28));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.18 : 0.3));
    osc.onended = () => ctx.close();
  } catch (err) {
    // بعض المتصفحات بتمنع الصوت قبل أول تفاعل من المستخدم — نتجاهل بهدوء
  }
}

/**
 * ماسح QR مستمر لتسجيل الحضور: بيفضل الكاميرا شغالة ويمرر الطلاب واحد ورا التاني
 * من غير ما يحتاج المستخدم يضغط زر كل مرة. كل مسح ناجح بيسجّل "حاضر" في تاريخ اليوم
 * (أو التاريخ المختار في شاشة الحضور) وبيعرض حالة الاشتراك المالي فوراً.
 */
export default function AttendanceScannerModal({ open, onClose, date, onRecorded, actorName }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const processingRef = useRef(false);
  const lastScanRef = useRef({}); // { [studentId]: timestamp }

  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState(null); // { type: 'success'|'error', name, sub, unpaidNote }
  const [scannedCount, setScannedCount] = useState(0);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const start = async () => {
      setCameraError('');
      setResult(null);
      setScannedCount(0);
      lastScanRef.current = {};
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'محتاجين إذن الكاميرا عشان نقدر نمسح الكارت. من فضلك اسمح بالوصول للكاميرا من إعدادات المتصفح.'
            : 'مش قادرين نفتح الكاميرا على الجهاز ده.'
        );
      }
    };

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tick = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (!processingRef.current) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code && code.data) {
          handleDecoded(code.data);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleDecoded = async (text) => {
    const studentId = parseStudentQrValue(text);
    if (!studentId) return;

    const now = Date.now();
    const last = lastScanRef.current[studentId];
    if (last && now - last < RESCAN_COOLDOWN_MS) return; // نفس الطالب لسه اتسجّل من ثواني

    processingRef.current = true;
    lastScanRef.current[studentId] = now;

    try {
      const { data: student } = await supabase
        .from('students')
        .select('id, name, student_number, group_id')
        .eq('id', studentId)
        .single();

      if (!student) {
        playBeep(false);
        setResult({ type: 'error', name: 'كود غير معروف', sub: 'الكود ده مش تابع لأي طالب في التطبيق.' });
        return;
      }

      if (!student.group_id) {
        playBeep(false);
        setResult({ type: 'error', name: student.name, sub: 'الطالب ده مش متضاف لمجموعة — اضبط المجموعة الأول.' });
        return;
      }

      const { data: attendanceRow, error: attError } = await supabase
        .from('attendance')
        .upsert(
          { student_id: student.id, group_id: student.group_id, date, status: 'present', updated_at: new Date().toISOString() },
          { onConflict: 'student_id,date' }
        )
        .select()
        .single();

      if (attError) {
        playBeep(false);
        setResult({ type: 'error', name: student.name, sub: 'حصل خطأ وإحنا بنسجّل الحضور، حاول تاني.' });
        return;
      }

      const now2 = new Date();
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', student.id)
        .eq('year', now2.getFullYear())
        .eq('month', now2.getMonth() + 1)
        .maybeSingle();

      let unpaidNote = null;
      if (!payment || payment.status !== 'paid') {
        const remaining = payment
          ? Math.max(0, (payment.amount_due || 0) - (payment.amount_paid || 0) - (payment.discount_amount || 0))
          : null;
        unpaidNote = remaining != null && remaining > 0 ? `⚠️ عليه متأخرات ${remaining} ج.م` : '⚠️ عليه متأخرات الشهر ده';
      }

      playBeep(true);
      setResult({
        type: 'success',
        name: student.name,
        sub: unpaidNote || '✅ دافع الاشتراك',
        unpaid: !!unpaidNote,
      });
      setScannedCount((c) => c + 1);

      logActivity(actorName, 'attendance', `${student.name} — حاضر (مسح QR) (${date})`);
      onRecorded?.(student.id, attendanceRow);
    } finally {
      setTimeout(() => {
        setResult(null);
        processingRef.current = false;
      }, RESULT_VISIBLE_MS);
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div className="scanner-overlay">
        <div className="scanner-header">
          <div>
            <strong>📷 مسح كارت الطالب</strong>
            <div className="muted" style={{ fontSize: 12.5 }}>
              تم تسجيل {scannedCount} حتى الآن — الكاميرا شغالة باستمرار
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <IconClose size={18} />
          </button>
        </div>

        <div className="scanner-viewport">
          {cameraError ? (
            <div className="scanner-camera-error">{cameraError}</div>
          ) : (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} playsInline muted className="scanner-video" />
              <div className="scanner-frame" />
            </>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {result && (
            <div className={`scanner-result ${result.type === 'success' ? (result.unpaid ? 'is-unpaid' : 'is-success') : 'is-error'}`}>
              <div className="scanner-result-title">
                {result.type === 'success' ? `تم تسجيل حضور: ${result.name} ✅` : `تعذّر التسجيل: ${result.name}`}
              </div>
              <div className="scanner-result-sub">{result.sub}</div>
            </div>
          )}
        </div>

        <div className="scanner-hint muted">وجّه الكاميرا على QR كارت الطالب — التسجيل بيتم أوتوماتيك.</div>
      </div>
    </Portal>
  );
}
