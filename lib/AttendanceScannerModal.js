'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import Portal from './Portal';
import { IconClose } from './icons';
import { supabase } from './supabaseClient';
import { parseStudentQrValue } from './qr';
import { logActivity } from './activityLog';
import { useStudentsIndex } from './useStudentsIndex';
import { useMonthlyPaymentsIndex } from './useMonthlyPaymentsIndex';
import { enqueue } from './offlineQueue';
import { useQueueSync } from './useQueueSync';
import { scheduleLabel, resolveScanStatus } from './schedule';

const RESCAN_COOLDOWN_MS = 4000; // منع تسجيل نفس الطالب تاني خلال ثواني من مسحه
const RESULT_VISIBLE_MS = 2200; // مدة ظهور نتيجة كل مسح على الشاشة قبل الرجوع للمسح
const NETWORK_TIMEOUT_MS = 4500; // لو النت بطيء جداً منستناش أكتر من كده — نسجّل ونحط في الطابور
const QUEUE_NAME = 'attendance-writes';

// عنصر AudioContext واحد يتعاد استخدامه لكل الأصوات — إنشاء Context جديد لكل بيب
// بيسبب تأخير محسوس (Lag) خصوصاً عند مسح عدد كبير من الطلاب بسرعة متتالية.
let sharedAudioCtx = null;
function getAudioCtx() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new Ctx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * أصوات المسح — تشتغل فوراً وبدون أي تأخير مع المسح التالي:
 * - success: نغمة تأكيد ناعمة وإيجابية (بيب واحد حاد) — تسجيل "حاضر".
 * - late: نغمتان متتاليتان مميزتان (double-beep) بنغمة أعمق — تسجيل "متأخر".
 * - warning: صفارتان بنغمة مربّعة — تنبيه "تحضير في غير موعد مجموعته" (حالة مختلفة عن late).
 * - error: نغمة تنبيه خطأ واضحة وقصيرة — باركود غير معروف/غير تابع لطالب.
 */
function playBeep(type = 'success') {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const tone = (freq, startAt, dur, waveType = 'sine', peak = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = waveType;
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + startAt;
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    };

    if (type === 'success') {
      // Present: بيب ناعم واحد، نغمة إيجابية حادة
      tone(880, 0, 0.16, 'sine', 0.25);
    } else if (type === 'late') {
      // Late: صوت double-beep مميز (نغمة triangle أعمق من صوت الحضور، وأهدأ من صوت الخطأ)
      tone(600, 0, 0.11, 'triangle', 0.22);
      tone(600, 0.16, 0.11, 'triangle', 0.22);
    } else if (type === 'warning') {
      // تحضير في غير موعد المجموعة: صفارتان متتاليتان بنغمة مربّعة تنازلية
      tone(620, 0, 0.13, 'square', 0.2);
      tone(480, 0.15, 0.17, 'square', 0.2);
    } else {
      // Error: نغمة تنبيه خطأ قصيرة وواضحة
      tone(220, 0, 0.24, 'sawtooth', 0.22);
    }
  } catch (err) {
    // بعض المتصفحات بتمنع الصوت قبل أول تفاعل من المستخدم — نتجاهل بهدوء
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

async function writeAttendanceRow(payload) {
  const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'student_id,date' });
  if (error) throw error;
}

/**
 * ماسح QR مستمر لتسجيل الحضور — Offline-First:
 * - بيانات الطلاب متحمّلة محلياً مسبقاً (useStudentsIndex)، فالمسح بيتعرف على
 *   الطالب فوراً من الكاش من غير ما يستنى أي رد من السيرفر.
 * - التسجيل Optimistic: الشاشة بتتحدّث والصوت بيتشغّل فوراً في نفس اللحظة،
 *   والرفع الفعلي لـ Supabase بيحصل في الخلفية.
 * - لو النت بطيء أو مقطوع، العملية بتتحط في طابور محلي وتتحاول تاني تلقائياً
 *   أول ما النت يرجع، من غير ما يوقف المسح أو يعطّل المستخدم.
 */
export default function AttendanceScannerModal({ open, onClose, date, onRecorded, actorName, activeGroupId, groups }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastScanRef = useRef({}); // { [studentId]: timestamp }

  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState(null); // { type: 'success'|'error', name, sub, unpaid }
  const [conflict, setConflict] = useState(null); // { student, message } — تحضير في غير موعد مجموعته
  const [scannedCount, setScannedCount] = useState(0);

  const { byId: studentsById, byToken: studentsByToken, isLoading: studentsLoading } = useStudentsIndex();
  const now = new Date();
  const { byStudent: paymentsByStudent } = useMonthlyPaymentsIndex(now.getFullYear(), now.getMonth() + 1);
  const { pendingCount } = useQueueSync(QUEUE_NAME, writeAttendanceRow);

  const groupsById = useMemo(() => {
    const m = new Map();
    (groups || []).forEach((g) => m.set(g.id, g));
    return m;
  }, [groups]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const start = async () => {
      setCameraError('');
      setResult(null);
      setConflict(null);
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

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        // مش بننتظر النتيجة هنا خالص — المسح بيفضل مستمر فوراً للطالب اللي بعده
        handleDecoded(code.data);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const showResult = (payload) => {
    setResult(payload);
    setTimeout(() => setResult(null), RESULT_VISIBLE_MS);
  };

  /** التسجيل الفعلي — Optimistic UI أولاً، بعدين الرفع في الخلفية بحد أقصى للانتظار */
  const recordAttendanceForStudent = (student, { exceptional = false } = {}) => {
    if (!student.group_id) {
      playBeep('error');
      showResult({ type: 'error', name: student.name, sub: 'الطالب ده مش متضاف لمجموعة — اضبط المجموعة الأول.' });
      return;
    }

    // ⚠️ الطالب اتحضّر في موعد مجموعة غير مجموعته المسجّل فيها — نوقف التسجيل التلقائي
    // ونستنى قرار المساعد (تحضير استثنائي أو إلغاء) بدل ما نسجّله على طول.
    if (!exceptional && activeGroupId && student.group_id !== activeGroupId) {
      playBeep('warning');
      const studentGroupName = groupsById.get(student.group_id)?.name || 'غير معروفة';
      const activeGroupName = groupsById.get(activeGroupId)?.name || 'المجموعة الحالية';
      setConflict({
        student,
        message: `⚠️ تنبيه: الطالب مسجل في [${studentGroupName}] وهذه [${activeGroupName}].`,
      });
      return;
    }

    const payment = paymentsByStudent.get(student.id);
    let unpaidNote = null;
    if (!payment || payment.status !== 'paid') {
      const remaining = payment
        ? Math.max(0, (payment.amount_due || 0) - (payment.amount_paid || 0) - (payment.discount_amount || 0))
        : null;
      unpaidNote = remaining != null && remaining > 0 ? `⚠️ عليه متأخرات ${remaining} ج.م` : '⚠️ عليه متأخرات الشهر ده';
    }

    // مقارنة وقت المسح الحالي بوقت بداية الحصة (المجموعة الجارية دلوقتي) + مدة السماح
    // المحددة لها (أو 15 دقيقة افتراضياً) لتحديد: حاضر ولا متأخر.
    const scannedAt = new Date();
    const sessionGroup = groupsById.get(activeGroupId);
    const status = resolveScanStatus(sessionGroup, date, scannedAt);
    const isLate = status === 'late';

    // ⚡ فوري: صوت + شارة + عداد — من غير أي انتظار للسيرفر، لضمان عدم وجود أي Lag
    // بين المسح وإطلاق الصوت حتى مع مسح عدد كبير من الطلاب متتالياً.
    playBeep(isLate ? 'late' : 'success');
    showResult({
      type: isLate ? 'late' : 'success',
      name: student.name,
      sub: exceptional
        ? `${isLate ? 'تأخير' : 'تحضير'} استثنائي${unpaidNote ? ' — ' + unpaidNote : ''}`
        : unpaidNote || (isLate ? '⏰ سجّل بعد وقت السماح بالحضور' : '✅ دافع الاشتراك'),
      unpaid: !!unpaidNote,
    });
    setScannedCount((c) => c + 1);
    const statusLabel = isLate ? 'متأخر' : 'حاضر';
    logActivity(
      actorName,
      'attendance',
      exceptional
        ? `${student.name} — ${statusLabel} استثنائي (مسح QR في غير موعد مجموعته) (${date})`
        : `${student.name} — ${statusLabel} (مسح QR) (${date})`
    );
    onRecorded?.(student.id, status);

    // الرفع الفعلي في الخلفية — لو اتأخر أو فشل، يتحط في طابور ويتحاول تاني لوحده
    const payloadRow = {
      student_id: student.id,
      group_id: student.group_id,
      date,
      status,
      scanned_at: scannedAt.toISOString(),
      updated_at: scannedAt.toISOString(),
    };
    withTimeout(writeAttendanceRow(payloadRow), NETWORK_TIMEOUT_MS).catch(() => {
      enqueue(QUEUE_NAME, payloadRow);
    });
  };

  const fetchAndRecord = async (parsed) => {
    try {
      const column = parsed.kind === 'token' ? 'parent_token' : 'id';
      const { data: student } = await withTimeout(
        supabase.from('students').select('id, name, student_number, group_id, parent_token').eq(column, parsed.value).single(),
        NETWORK_TIMEOUT_MS
      );
      if (student) {
        recordAttendanceForStudent(student);
        return;
      }
    } catch {
      // هيتعامل معاه في رسالة الخطأ تحت
    }
    playBeep('error');
    showResult({
      type: 'error',
      name: 'كود غير معروف',
      sub: studentsLoading ? 'قائمة الطلاب لسه بتتحمّل — جرّب تاني بعد لحظات.' : 'الكود ده مش تابع لأي طالب في التطبيق.',
    });
  };

  /** المساعد اختار "تحضير استثنائي" — نسجّل الحضور فعلياً رغم اختلاف المجموعة */
  const confirmExceptionalAttendance = () => {
    if (!conflict) return;
    const { student } = conflict;
    setConflict(null);
    recordAttendanceForStudent(student, { exceptional: true });
  };

  /** المساعد اختار "إلغاء" — رجوع للمسح من غير تسجيل حضور */
  const cancelConflict = () => setConflict(null);

  const handleDecoded = (text) => {
    const parsed = parseStudentQrValue(text);
    if (!parsed) return;

    const scanTime = Date.now();
    const last = lastScanRef.current[parsed.value];
    if (last && scanTime - last < RESCAN_COOLDOWN_MS) return; // نفس الطالب لسه اتسجّل من ثواني
    lastScanRef.current[parsed.value] = scanTime;

    const cachedStudent = parsed.kind === 'token' ? studentsByToken.get(parsed.value) : studentsById.get(parsed.value);
    if (cachedStudent) {
      recordAttendanceForStudent(cachedStudent); // ⚡ المسار الشائع: تعرّف فوري من الكاش المحلي
    } else {
      fetchAndRecord(parsed); // نادر: طالب جديد لسه ما وصلش الكاش، نحاول من السيرفر
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
              تم تسجيل {scannedCount} حتى الآن
              {pendingCount > 0 && ` — 🔄 ${pendingCount} قيد المزامنة`}
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
            <div
              className={`scanner-result ${
                result.type === 'late'
                  ? 'is-late'
                  : result.type === 'success'
                  ? result.unpaid
                    ? 'is-unpaid'
                    : 'is-success'
                  : 'is-error'
              }`}
            >
              <div className="scanner-result-title">
                {result.type === 'success' && `تم تسجيل حضور: ${result.name} ✅`}
                {result.type === 'late' && `تم تسجيل تأخير: ${result.name} ⏰`}
                {result.type === 'error' && `تعذّر التسجيل: ${result.name}`}
              </div>
              <div className="scanner-result-sub">{result.sub}</div>
            </div>
          )}

          {conflict && (
            <div className="scanner-result is-conflict">
              <div className="scanner-result-title">{conflict.student.name}</div>
              <div className="scanner-result-sub">{conflict.message}</div>
              {(() => {
                const activeGroup = groupsById.get(activeGroupId);
                const label = activeGroup ? scheduleLabel(activeGroup) : null;
                return label ? <div className="scanner-result-sub" style={{ marginTop: 2 }}>موعد المجموعة الحالية: {label}</div> : null;
              })()}
              <div className="scanner-conflict-actions">
                <button className="scanner-conflict-btn-confirm" onClick={confirmExceptionalAttendance}>
                  تحضير استثنائي
                </button>
                <button className="scanner-conflict-btn-cancel" onClick={cancelConflict}>
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="scanner-hint muted">
          وجّه الكاميرا على QR كارت الطالب — التسجيل بيتم أوتوماتيك حتى لو النت بطيء.
        </div>
      </div>
    </Portal>
  );
}
