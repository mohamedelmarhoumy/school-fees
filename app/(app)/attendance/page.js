'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { buildWhatsAppLink } from '../../../lib/whatsapp';
import { ATTENDANCE_STATUS_LABELS } from '../../../lib/constants';
import Button from '../../../lib/Button';
import { SkeletonCards } from '../../../lib/Skeleton';
import EmptyState from '../../../lib/EmptyState';
import { downloadCsv } from '../../../lib/exportCsv';
import SessionSummaryModal from '../../../lib/SessionSummaryModal';

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
  const [rows, setRows] = useState([]); // { student, record, unpaid }
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    const loadGradesGroups = async () => {
      const { data: gradesData } = await supabase.from('grades').select('*').order('name');
      const { data: groupsData } = await supabase.from('groups_table').select('*').order('name');
      setGrades(gradesData || []);
      setGroups(groupsData || []);

      if (presetGroupId) {
        const presetGroup = (groupsData || []).find((g) => g.id === presetGroupId);
        if (presetGroup) {
          setGradeId(presetGroup.grade_id);
          setGroupId(presetGroup.id);
          return;
        }
      }
      if (gradesData && gradesData.length > 0 && !gradeId) setGradeId(gradesData[0].id);
    };
    loadGradesGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupsForGrade = groups.filter((g) => g.grade_id === gradeId);

  useEffect(() => {
    if (groupsForGrade.length > 0 && !groupsForGrade.some((g) => g.id === groupId)) {
      setGroupId(groupsForGrade[0].id);
    } else if (groupsForGrade.length === 0) {
      setGroupId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, groups]);

  const loadSession = async () => {
    if (!groupId) {
      setRows([]);
      return;
    }
    setLoading(true);

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

    const toInsert = (students || [])
      .filter((s) => !recordsByStudent[s.id])
      .map((s) => ({ student_id: s.id, group_id: groupId, date, status: 'present' }));

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

    const combined = (students || [])
      .map((s) => ({
        student: s,
        record: recordsByStudent[s.id],
        unpaid: paymentsByStudent[s.id] && paymentsByStudent[s.id].status !== 'paid',
      }))
      .sort((a, b) => a.student.name.localeCompare(b.student.name));

    setRows(combined);
    setLoading(false);
  };

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, date]);

  const setStatus = async (row, status) => {
    await supabase
      .from('attendance')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', row.record.id);
    loadSession();
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

  const presentCount = rows.filter((r) => (r.record?.status || 'present') === 'present').length;
  const absentCount = rows.filter((r) => r.record?.status === 'absent').length;
  const lateCount = rows.filter((r) => r.record?.status === 'late').length;

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

        {groupId && !loading && (
          <div className="row-between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span className="muted">
              عدد الطلاب: <strong style={{ color: 'var(--text)' }}>{rows.length}</strong>
              {rows.length > 0 && (
                <> — حاضر {presentCount} / تأخير {lateCount} / غائب {absentCount}</>
              )}
            </span>
            <Button variant="outline" size="sm" loading={exporting} onClick={exportAttendance}>
              تصدير (CSV)
            </Button>
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
          const status = row.record?.status || 'present';
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
