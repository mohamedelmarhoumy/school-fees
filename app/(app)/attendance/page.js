'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { buildWhatsAppLink } from '../../../lib/whatsapp';
import { ATTENDANCE_STATUS_LABELS } from '../../../lib/constants';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AttendancePage() {
  const [grades, setGrades] = useState([]);
  const [groups, setGroups] = useState([]);
  const [gradeId, setGradeId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]); // { student, record, unpaid }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadGradesGroups = async () => {
      const { data: gradesData } = await supabase.from('grades').select('*').order('name');
      const { data: groupsData } = await supabase.from('groups_table').select('*').order('name');
      setGrades(gradesData || []);
      setGroups(groupsData || []);
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

    // ensure session generated: أنشئ سجل "حاضر" لكل طالب في المجموعة ليس له سجل في هذا التاريخ
    const toInsert = (students || [])
      .filter((s) => !recordsByStudent[s.id])
      .map((s) => ({ student_id: s.id, group_id: groupId, date, status: 'present' }));

    if (toInsert.length > 0) {
      const { data: inserted } = await supabase.from('attendance').insert(toInsert).select();
      (inserted || []).forEach((r) => {
        recordsByStudent[r.student_id] = r;
      });
    }

    // مؤشر المتأخرات المالية للشهر الحالي
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
      </div>

      {!groupId && <div className="muted">أضف صفاً ومجموعة أولاً من شاشة الصفوف.</div>}
      {loading && <div className="muted">جارِ التحميل...</div>}

      {!loading && groupId && rows.length === 0 && <div className="muted">لا يوجد طلاب في هذه المجموعة.</div>}

      {!loading &&
        rows.map((row) => {
          const status = row.record?.status || 'present';
          return (
            <div key={row.student.id} className="card row-between">
              <div className="row">
                {row.unpaid && <span title="عليه متأخرات مالية للشهر الحالي">⚠️</span>}
                <span>{row.student.name}</span>
              </div>
              <div className="row">
                {status === 'absent' && (
                  <a
                    className="btn btn-whatsapp btn-sm"
                    href={buildWhatsAppLink(
                      row.student.parent_phone,
                      `تنويه: الطالب ${row.student.name} كان غائباً عن الحصة بتاريخ ${date}. برجاء المتابعة، وشكراً.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    واتساب
                  </a>
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
