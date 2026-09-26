'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { supabase } from '../../../lib/supabaseClient';
import { buildWhatsAppLink } from '../../../lib/whatsapp';
import { ATTENDANCE_STATUS_LABELS } from '../../../lib/constants';
import Button from '../../../lib/Button';
import { SkeletonCards } from '../../../lib/Skeleton';
import EmptyState from '../../../lib/EmptyState';
import { downloadCsv } from '../../../lib/exportCsv';
import SessionSummaryModal from '../../../lib/SessionSummaryModal';
import { useProfile } from '../../../lib/useProfile';
import { logActivity } from '../../../lib/activityLog';
import { printReport } from '../../../lib/printReport';
import AttendanceScannerModal from '../../../lib/AttendanceScannerModal';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="muted">جارِ التحميل...</div>}>
      <AttendanceContent />
    </Suspense>
  );
}

function AttendanceContent() {
  const searchParams = useSearchParams();
  const presetGroupId = searchParams.get('groupId');
  const presetDate = searchParams.get('date');

  const [grades, setGrades] = useState([]);
  const [groups, setGroups] = useState([]);
  const [gradeId, setGradeId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState(presetDate || todayStr());
  const [exporting, setExporting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const { profile, isOwner, loading: profileLoading } = useProfile();
  const didInitGrade = useRef(false);

  // ⚡ الصفوف والمجموعات: SWR بيرجّع آخر نسخة معروفة فوراً من الكاش المحلي
  // (حتى من غير نت) وبعدين يحدّثها بهدوء في الخلفية.
  const { data: gradesGroupsData } = useSWR('grades-groups-index', async () => {
    const [{ data: gradesData }, { data: groupsData }] = await Promise.all([
      supabase.from('grades').select('*').order('name'),
      supabase.from('groups_table').select('*').order('name'),
    ]);
    return { grades: gradesData || [], groups: groupsData || [] };
  });

  useEffect(() => {
    if (!gradesGroupsData) return;
    setGrades(gradesGroupsData.grades);
    setGroups(gradesGroupsData.groups);
    if (didInitGrade.current) return; // نحدّد الصف/المجموعة الافتراضيين مرة واحدة بس

    if (presetGroupId) {
      const presetGroup = gradesGroupsData.groups.find((g) => g.id === presetGroupId);
      if (presetGroup) {
        setGradeId(presetGroup.grade_id);
        setGroupId(presetGroup.id);
        didInitGrade.current = true;
        return;
      }
    }
    if (gradesGroupsData.grades.length > 0) {
      setGradeId(gradesGroupsData.grades[0].id);
      didInitGrade.current = true;
    }
  }, [gradesGroupsData, presetGroupId]);

  const groupsForGrade = groups.filter((g) => g.grade_id === gradeId);

  useEffect(() => {
    if (groupsForGrade.length > 0 && !groupsForGrade.some((g) => g.id === groupId)) {
      setGroupId(groupsForGrade[0].id);
    } else if (groupsForGrade.length === 0) {
      setGroupId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, groups]);

  const sessionKey = groupId ? `attendance-session:${groupId}:${date}` : null;
  const loadSessionData = async () => {
    const { data: students } = await supabase.from('students').select('*').eq('group_id', groupId).order('name');
    const { data: existingRecords } = await supabase
      .from('attendance')
      .select('*')
      .eq('group_id', groupId)
      .eq('date', date);

    const recordsByStudent = {};
    (existingRecords || []).forEach((r) => {
      recordsByStudent[r.student_id] = r;
    });

    // الحالة الافتراضية لكل طالب عند بداية الحصة: "غائب" — بتتحول "حاضر"/"متأخر"
    // تلقائياً بس لما يتمسح له باركود.
    const toInsert = (students || [])
      .filter((s) => !recordsByStudent[s.id])
      .map((s) => ({ student_id: s.id, group_id: groupId, date, status: 'absent' }));

    if (toInsert.length > 0) {
      const { data: inserted } = await supabase.from('attendance').insert(toInsert).select();
      (inserted || []).forEach((r) => {
        recordsByStudent[r.student_id] = r;
      });
    }

    const now = new Date();
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('year', now.getFullYear())
      .eq('month', now.getMonth() + 1);
    const paymentsByStudent = {};
    (payments || []).forEach((p) => {
      paymentsByStudent[p.student_id] = p;
    });

    return (students || [])
      .map((s) => ({
        student: s,
        record: recordsByStudent[s.id],
        unpaid: paymentsByStudent[s.id] && paymentsByStudent[s.id].status !== 'paid',
      }))
      .sort((a, b) => a.student.name.localeCompare(b.student.name));
  };

  // ⚡ نفس فكرة الـ Stale-While-Revalidate: لو الجلسة دي اتفتحت قبل كده، تظهر
  // فوراً من الكاش، وفي الخلفية بيتعمل تحديث هادئ من السيرفر.
  const { data: rowsData, isLoading: sessionLoading, mutate: mutateSession } = useSWR(
    sessionKey,
    loadSessionData
  );
  const rows = rowsData || [];
  const loading = !!groupId && sessionLoading && !rowsData;

  const setStatus = async (row, status) => {
    // ⚡ تحديث فوري في الواجهة قبل أي رد من السيرفر
    mutateSession(
      (current) =>
        (current || []).map((r) =>
          r.student.id === row.student.id ? { ...r, record: { ...r.record, status } } : r
        ),
      false
    );
    try {
      await supabase
        .from('attendance')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', row.record.id);
      logActivity(
        profile?.display_name || profile?.email,
        'attendance',
        `${row.student.name} — ${ATTENDANCE_STATUS_LABELS[status]} (${date})`
      );
    } finally {
      mutateSession();
    }
  };

  // بيتنفّذ فور ما ماسح الـ QR يسجّل طالب حاضر أو متأخر — بيحدّث نفس الشاشة فوراً
  // من غير ما يستنى إعادة تحميل كاملة من السيرفر.
  const applyOptimisticScan = (studentId, status) => {
    mutateSession(
      (current) =>
        (current || []).map((r) =>
          r.student.id === studentId ? { ...r, record: { ...(r.record || {}), status } } : r
        ),
      false
    );
  };

  const exportAttendance = async () => {
    setExporting(true);
    const { data: records } = await supabase
      .from('attendance')
      .select('*, students(name)')
      .eq('date', date);
    const csvRows = (records || []).map((r) => [r.students?.name || '', r.date, r.status]);
    downloadCsv(`حضور-${date}.csv`, ['اسم الطالب', 'التاريخ', 'الحالة'], csvRows);
    setExporting(false);
  };

  const exportAttendancePdf = () => {
    const groupName = groupsForGrade.find((g) => g.id === groupId)?.name || '';
    const pdfRows = rows.map((r) => [r.student.name, ATTENDANCE_STATUS_LABELS[r.record?.status || 'absent']]);
    printReport({
      title: `كشف حضور — ${groupName}`,
      subtitle: `حصتي — التاريخ: ${date}`,
      columns: ['اسم الطالب', 'الحالة'],
      rows: pdfRows,
      totalsLine: `عدد الطلاب: ${rows.length} — حاضر ${presentCount} / تأخير ${lateCount} / غائب ${absentCount}`,
    });
  };

  const presentCount = rows.filter((r) => r.record?.status === 'present').length;
  const absentCount = rows.filter((r) => (r.record?.status || 'absent') === 'absent').length;
  const lateCount = rows.filter((r) => r.record?.status === 'late').length;

  if (profileLoading) return <div className="muted">جارِ التحميل...</div>;

  if (!isOwner && !profile?.can_attendance) {
    return <EmptyState title="غير مصرح لك بالدخول هنا" hint="مفيش صلاحية تسجيل الحضور على حسابك." />;
  }

  return (
    <div>
      <h2>الحضور والغياب</h2>

      <div className="card">
        <div className="row">
          <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} style={{ flex: 1 }}>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ flex: 1 }}>
            {groupsForGrade.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="row" style={{ marginTop: 8, justifyContent: 'center' }}>
          <span>📅</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <Button
          variant="primary"
          size="sm"
          style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
          onClick={() => setScannerOpen(true)}
        >
          📷 مسح كارت الطالب
        </Button>

        {groupId && !loading && (
          <div className="row-between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span className="muted">
              عدد الطلاب: <strong style={{ color: 'var(--text)' }}>{rows.length}</strong>
              {rows.length > 0 && (
                <> — حاضر {presentCount} / تأخير {lateCount} / غائب {absentCount}</>
              )}
            </span>
            <div className="row">
              <Button variant="outline" size="sm" loading={exporting} onClick={exportAttendance}>
                تصدير (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={exportAttendancePdf}>
                طباعة / PDF
              </Button>
            </div>
          </div>
        )}

        {groupId && !loading && rows.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
            onClick={() => setSummaryOpen(true)}
          >
            📋 إعداد ملخص الحصة
          </Button>
        )}
      </div>

      <AttendanceScannerModal
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          mutateSession(); // مزامنة هادئة في الخلفية بعد قفل الماسح، للتأكد إن كل حاجة اتسجّلت فعلاً
        }}
        date={date}
        actorName={profile?.display_name || profile?.email}
        onRecorded={(studentId, status) => applyOptimisticScan(studentId, status)}
        activeGroupId={groupId}
        groups={groups}
      />

      <SessionSummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        groupName={groupsForGrade.find((g) => g.id === groupId)?.name || ''}
        dateLabel={date}
        students={rows.map((r) => ({ id: r.student.id, name: r.student.name, parent_phone: r.student.parent_phone }))}
      />

      {!groupId && <EmptyState title="أضف صفاً ومجموعة أولاً" hint="من شاشة الصفوف." />}
      {loading && <SkeletonCards count={4} />}

      {!loading && groupId && rows.length === 0 && (
        <EmptyState title="لا يوجد طلاب في هذه المجموعة" />
      )}

      {!loading &&
        rows.map((row) => {
          const status = row.record?.status || 'absent';
          const hasPhone = !!row.student.parent_phone;
          return (
            <div key={row.student.id} className="card row-between">
              <div className="row">
                {row.unpaid && <span title="عليه متأخرات مالية للشهر الحالي">⚠️</span>}
                <span>{row.student.name}</span>
              </div>
              <div className="row">
                {status === 'absent' && hasPhone && (
                  <Button
                    as="a"
                    variant="whatsapp"
                    size="sm"
                    href={buildWhatsAppLink(
                      row.student.parent_phone,
                      `تنويه: الطالب ${row.student.name} كان غائباً عن الحصة بتاريخ ${date}. برجاء المتابعة، وشكراً.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    واتساب
                  </Button>
                )}
                <div className="segmented">
                  {['present', 'late', 'absent'].map((s) => (
                    <button
                      key={s}
                      className={status === s ? `selected-${s}` : ''}
                      onClick={() => setStatus(row, s)}
                    >
                      {ATTENDANCE_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
