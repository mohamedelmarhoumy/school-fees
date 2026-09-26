'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import jsQR from 'jsqr';
import { supabase } from '../../../lib/supabaseClient';
import { scheduleLabel } from '../../../lib/schedule';
import { parseStudentQrValue } from '../../../lib/qr';
import { useStudentsIndex } from '../../../lib/useStudentsIndex';
import { logActivity } from '../../../lib/activityLog';
import { useProfile } from '../../../lib/useProfile';
import Button from '../../../lib/Button';
import EmptyState from '../../../lib/EmptyState';

const SCAN_COOLDOWN_MS = 2000;

/** بيب قصير عند نجاح/فشل تحديد الطالب بالـ QR — نفس أسلوب شاشة الحضور */
function playBeep(ok = true) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = ok ? 880 : 300;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.14 : 0.24));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.16 : 0.26));
    osc.onended = () => ctx.close();
  } catch {
    // بعض المتصفحات بتمنع الصوت قبل أول تفاعل من المستخدم — نتجاهل بهدوء
  }
}

export default function QuizGradingPage() {
  const searchParams = useSearchParams();
  const { profile, isOwner } = useProfile();
  const canManage = isOwner || !!profile?.can_students;

  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(searchParams.get('groupId') || '');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [quizName, setQuizName] = useState('');
  const [maxScore, setMaxScore] = useState('10');
  const [quizDate, setQuizDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState({}); // { [studentId]: { score, note } }

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [scannerOn, setScannerOn] = useState(false);
  const [scanToast, setScanToast] = useState('');

  const scoreRefs = useRef({}); // { [studentId]: HTMLInputElement }
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastScanRef = useRef({});

  const { byId: studentsById, byToken: studentsByToken } = useStudentsIndex();

  useEffect(() => {
    supabase
      .from('groups_table')
      .select('*, grades(name)')
      .order('name')
      .then(({ data }) => setGroups(data || []));
  }, []);

  useEffect(() => {
    if (!groupId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    supabase
      .from('students')
      .select('id, name, student_number')
      .eq('group_id', groupId)
      .order('student_number')
      .then(({ data }) => {
        setStudents(data || []);
        setEntries({});
        setLoadingStudents(false);
      });
  }, [groupId]);

  const selectedGroup = groups.find((g) => g.id === groupId);

  const setEntry = (studentId, field, value) => {
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const focusScoreInput = (studentId) => {
    const el = scoreRefs.current[studentId];
    if (el) {
      el.focus();
      el.select();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  /** Enter بينقل المؤشر لخانة درجة الطالب اللي بعده مباشرة — أسرع من Tab اللي بيمر على خانة الملاحظة الأول */
  const handleScoreKeyDown = (e, index) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = students[index + 1];
    if (next) focusScoreInput(next.id);
  };

  // ===== مسح QR للتحديد السريع (Speed Grading) =====
  useEffect(() => {
    if (!scannerOn) return;
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
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
      } catch {
        setScanToast('مش قادرين نفتح الكاميرا على الجهاز ده.');
      }
    };

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
        if (code && code.data) handleScanned(code.data);
      }
      rafRef.current = requestAnimationFrame(tick);
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
  }, [scannerOn, students]);

  const handleScanned = (text) => {
    const parsed = parseStudentQrValue(text);
    if (!parsed) return;
    const student = parsed.kind === 'token' ? studentsByToken.get(parsed.value) : studentsById.get(parsed.value);
    if (!student) return;

    const now = Date.now();
    if (lastScanRef.current[student.id] && now - lastScanRef.current[student.id] < SCAN_COOLDOWN_MS) return;
    lastScanRef.current[student.id] = now;

    const inThisGroup = students.some((s) => s.id === student.id);
    if (!inThisGroup) {
      playBeep(false);
      setScanToast(`⚠️ ${student.name} مش في المجموعة دي`);
      setTimeout(() => setScanToast(''), 2200);
      return;
    }

    playBeep(true);
    setScanToast(`✅ ${student.name} — اكتب الدرجة`);
    setTimeout(() => setScanToast(''), 1600);
    focusScoreInput(student.id);
  };

  const gradedCount = useMemo(
    () => students.filter((s) => String(entries[s.id]?.score ?? '').trim() !== '').length,
    [students, entries]
  );

  const canSave = groupId && quizName.trim() && Number(maxScore) > 0 && gradedCount > 0 && !saving;

  if (!canManage) {
    return <EmptyState title="غير مصرح لك بالدخول هنا" hint="رصد الدرجات للمدرس أو المساعد اللي له صلاحية الطلاب بس." />;
  }

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSavedMsg('');
    const actorName = profile?.display_name || profile?.email;

    const rows = students
      .filter((s) => String(entries[s.id]?.score ?? '').trim() !== '')
      .map((s) => ({
        student_id: s.id,
        quiz_date: quizDate,
        lesson_name: quizName.trim(),
        score: Number(entries[s.id]?.score) || 0,
        max_score: Number(maxScore) || 0,
        note: entries[s.id]?.note?.trim() || null,
      }));

    const { error } = await supabase.from('student_scores').insert(rows);
    setSaving(false);
    if (error) {
      setSavedMsg('⚠️ حصلت مشكلة أثناء الحفظ — جرّب تاني.');
      return;
    }

    logActivity(
      actorName,
      'quiz_bulk_graded',
      `"${quizName.trim()}" — رصد درجات ${rows.length} طالب دفعة واحدة (${selectedGroup?.grades?.name || ''} — ${selectedGroup?.name || ''})`
    );
    setSavedMsg(`✅ اتحفظت درجات ${rows.length} طالب، وهتظهر فوراً في رابط متابعة كل ولي أمر.`);
    setEntries({}); // الاسم والدرجة الكلية فاضلين زي ما هما لو حابب ترصد نفس الكويز لمجموعة تانية
  };

  return (
    <div>
      <h2>رصد درجات جماعي</h2>

      <div className="card">
        <div className="muted" style={{ marginBottom: 6, fontSize: 12.5 }}>بيانات الكويز</div>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ width: '100%' }}>
          <option value="">اختر المجموعة</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.grades?.name ? `${g.grades.name} — ` : ''}{g.name}{scheduleLabel(g) ? ` (${scheduleLabel(g)})` : ''}
            </option>
          ))}
        </select>

        <div className="row" style={{ marginTop: 8 }}>
          <input
            placeholder="اسم الكويز (مثال: اختبار الوحدة الأولى)"
            value={quizName}
            onChange={(e) => setQuizName(e.target.value)}
            style={{ flex: 2 }}
          />
          <input
            type="number"
            placeholder="الدرجة النهائية"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <input type="date" value={quizDate} onChange={(e) => setQuizDate(e.target.value)} style={{ marginTop: 8, width: '100%' }} />
      </div>

      {groupId && (
        <div className="card row-between">
          <strong>{gradedCount} / {students.length} اتحطلهم درجة</strong>
          <Button variant={scannerOn ? 'primary' : 'outline'} size="sm" onClick={() => setScannerOn((v) => !v)}>
            📷 {scannerOn ? 'إيقاف المسح' : 'مسح QR للتحديد السريع'}
          </Button>
        </div>
      )}

      {scannerOn && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block', maxHeight: 220, objectFit: 'cover' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {scanToast && (
            <div style={{ position: 'absolute', bottom: 8, right: 8, left: 8, background: 'rgba(0,0,0,0.72)', color: '#fff', padding: '8px 10px', borderRadius: 10, fontSize: 13, textAlign: 'center' }}>
              {scanToast}
            </div>
          )}
        </div>
      )}

      {savedMsg && (
        <div className="card" style={{ borderRight: savedMsg.startsWith('✅') ? '3px solid #16a34a' : '3px solid #dc2626' }}>
          {savedMsg}
        </div>
      )}

      {!groupId && <EmptyState title="اختر مجموعة الأول" hint="هتظهر قائمة طلابها تلقائياً تحت." />}

      {groupId && loadingStudents && <div className="muted">جارِ تحميل الطلاب...</div>}

      {groupId && !loadingStudents && students.length === 0 && (
        <EmptyState title="مفيش طلاب في المجموعة دي" hint="أضف طلاب للمجموعة الأول من شاشة الطلاب." />
      )}

      {students.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="scores-table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th style={{ width: 90 }}>الدرجة</th>
                <th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    <input
                      type="number"
                      ref={(el) => { scoreRefs.current[s.id] = el; }}
                      value={entries[s.id]?.score ?? ''}
                      onChange={(e) => setEntry(s.id, 'score', e.target.value)}
                      onKeyDown={(e) => handleScoreKeyDown(e, i)}
                      style={{ width: 68 }}
                      placeholder="—"
                    />
                  </td>
                  <td>
                    <input
                      value={entries[s.id]?.note ?? ''}
                      onChange={(e) => setEntry(s.id, 'note', e.target.value)}
                      style={{ width: '100%' }}
                      placeholder="اختياري"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {students.length > 0 && (
        <Button
          loading={saving}
          disabled={!canSave}
          onClick={save}
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
        >
          حفظ ورصد درجات المجموعة
        </Button>
      )}
    </div>
  );
}
