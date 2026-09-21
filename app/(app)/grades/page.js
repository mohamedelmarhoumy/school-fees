'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { WEEKDAY_LABELS, SATURDAY_FIRST_ORDER } from '../../../lib/constants';
import { scheduleLabel } from '../../../lib/schedule';
import Button from '../../../lib/Button';
import { useProfile } from '../../../lib/useProfile';
import EmptyState from '../../../lib/EmptyState';
import { IconPencil, IconTrash, IconMessage } from '../../../lib/icons';
import BulkWhatsAppModal from '../../../lib/BulkWhatsAppModal';
import SlideUpModal from '../../../lib/SlideUpModal';

const emptyGroupForm = { name: '', days: [], start_time: '', end_time: '' };

function DaysPicker({ selectedDays, onToggle }) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
      {SATURDAY_FIRST_ORDER.map((index) => (
        <button
          key={index}
          type="button"
          className="btn btn-sm"
          onClick={() => onToggle(index)}
          style={{
            background: selectedDays.includes(index) ? 'var(--btn-primary-bg)' : 'var(--card-bg)',
            color: selectedDays.includes(index) ? 'var(--btn-primary-text)' : 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          {WEEKDAY_LABELS[index]}
        </button>
      ))}
    </div>
  );
}

export default function GradesPage() {
  const [grades, setGrades] = useState([]);
  const [groupsByGrade, setGroupsByGrade] = useState({});
  const [loading, setLoading] = useState(true);
  const [newGradeName, setNewGradeName] = useState('');
  const [newGradeFee, setNewGradeFee] = useState('');
  const [newGroupFormByGrade, setNewGroupFormByGrade] = useState({});
  const [editingGradeId, setEditingGradeId] = useState(null);
  const [editGradeName, setEditGradeName] = useState('');
  const [editGradeFee, setEditGradeFee] = useState('');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupForm, setEditGroupForm] = useState(emptyGroupForm);
  const [addingGrade, setAddingGrade] = useState(false);
  const [addingGroupFor, setAddingGroupFor] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRecipients, setBulkRecipients] = useState([]);
  const [bulkTitle, setBulkTitle] = useState('');
  const [addGradeOpen, setAddGradeOpen] = useState(false);
  const { loading: profileLoading, isOwner } = useProfile();
  const [groupStats, setGroupStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const { data: gradesData } = await supabase.from('grades').select('*').order('name');
    const { data: groupsData } = await supabase.from('groups_table').select('*').order('name');
    setGrades(gradesData || []);
    const grouped = {};
    (groupsData || []).forEach((g) => {
      if (!grouped[g.grade_id]) grouped[g.grade_id] = [];
      grouped[g.grade_id].push(g);
    });
    setGroupsByGrade(grouped);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [{ data: students }, { data: attendance }, { data: payments }] = await Promise.all([
      supabase.from('students').select('id, group_id'),
      supabase.from('attendance').select('group_id, status').gte('date', monthStart),
      supabase.from('payments').select('student_id, status').eq('year', now.getFullYear()).eq('month', now.getMonth() + 1),
    ]);

    const studentsByGroup = {};
    const groupByStudent = {};
    (students || []).forEach((s) => {
      if (!s.group_id) return;
      studentsByGroup[s.group_id] = (studentsByGroup[s.group_id] || 0) + 1;
      groupByStudent[s.id] = s.group_id;
    });

    const attendanceByGroup = {};
    (attendance || []).forEach((a) => {
      if (!attendanceByGroup[a.group_id]) attendanceByGroup[a.group_id] = { present: 0, total: 0 };
      attendanceByGroup[a.group_id].total += 1;
      if (a.status === 'present') attendanceByGroup[a.group_id].present += 1;
    });

    const paymentsByGroup = {};
    (payments || []).forEach((p) => {
      const gid = groupByStudent[p.student_id];
      if (!gid) return;
      if (!paymentsByGroup[gid]) paymentsByGroup[gid] = { paid: 0, total: 0 };
      paymentsByGroup[gid].total += 1;
      if (p.status === 'paid') paymentsByGroup[gid].paid += 1;
    });

    const stats = {};
    Object.keys(studentsByGroup).forEach((gid) => {
      const att = attendanceByGroup[gid];
      const pay = paymentsByGroup[gid];
      stats[gid] = {
        studentCount: studentsByGroup[gid],
        attendanceRate: att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null,
        paidCount: pay?.paid || 0,
        paidTotal: pay?.total || 0,
      };
    });
    setGroupStats(stats);
    setLoadingStats(false);
  };

  const addGrade = async (e) => {
    e.preventDefault();
    if (!newGradeName.trim()) return;
    setAddingGrade(true);
    await supabase.from('grades').insert({
      name: newGradeName.trim(),
      monthly_fee: Number(newGradeFee) || 0,
    });
    setNewGradeName('');
    setNewGradeFee('');
    await loadAll();
    setAddingGrade(false);
    setAddGradeOpen(false);
  };

  const saveGradeEdit = async (id) => {
    await supabase
      .from('grades')
      .update({ name: editGradeName.trim(), monthly_fee: Number(editGradeFee) || 0, updated_at: new Date().toISOString() })
      .eq('id', id);
    setEditingGradeId(null);
    loadAll();
  };

  const deleteGrade = async (id) => {
    if (!confirm('حذف هذا الصف سيحذف كل مجموعاته المرتبطة به. متأكد؟')) return;
    await supabase.from('grades').delete().eq('id', id);
    loadAll();
  };

  const getNewGroupForm = (gradeId) => newGroupFormByGrade[gradeId] || emptyGroupForm;

  const updateNewGroupForm = (gradeId, patch) => {
    setNewGroupFormByGrade((s) => ({ ...s, [gradeId]: { ...getNewGroupForm(gradeId), ...patch } }));
  };

  const toggleNewGroupDay = (gradeId, dayIndex) => {
    const current = getNewGroupForm(gradeId).days;
    const next = current.includes(dayIndex) ? current.filter((d) => d !== dayIndex) : [...current, dayIndex];
    updateNewGroupForm(gradeId, { days: next });
  };

  const addGroup = async (gradeId) => {
    const form = getNewGroupForm(gradeId);
    if (!form.name.trim()) return;
    setAddingGroupFor(gradeId);
    await supabase.from('groups_table').insert({
      grade_id: gradeId,
      name: form.name.trim(),
      days_of_week: form.days,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
    });
    setNewGroupFormByGrade((s) => ({ ...s, [gradeId]: emptyGroupForm }));
    await loadAll();
    setAddingGroupFor(null);
  };

  const startEditGroup = (group) => {
    setEditingGroupId(group.id);
    setEditGroupForm({
      name: group.name,
      days: group.days_of_week || [],
      start_time: group.start_time ? group.start_time.slice(0, 5) : '',
      end_time: group.end_time ? group.end_time.slice(0, 5) : '',
    });
  };

  const toggleEditGroupDay = (dayIndex) => {
    const current = editGroupForm.days;
    const next = current.includes(dayIndex) ? current.filter((d) => d !== dayIndex) : [...current, dayIndex];
    setEditGroupForm({ ...editGroupForm, days: next });
  };

  const saveGroupEdit = async (id) => {
    await supabase
      .from('groups_table')
      .update({
        name: editGroupForm.name.trim(),
        days_of_week: editGroupForm.days,
        start_time: editGroupForm.start_time || null,
        end_time: editGroupForm.end_time || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setEditingGroupId(null);
    loadAll();
  };

  const deleteGroup = async (id) => {
    if (!confirm('حذف هذه المجموعة نهائياً؟')) return;
    await supabase.from('groups_table').delete().eq('id', id);
    loadAll();
  };

  const openGroupBulkMessage = async (group, gradeName) => {
    const { data } = await supabase.from('students').select('*').eq('group_id', group.id);
    setBulkRecipients(
      (data || []).map((s) => ({ name: s.name, phone: s.parent_phone, groupName: group.name, gradeName }))
    );
    setBulkTitle(`مجموعة ${group.name}`);
    setBulkOpen(true);
  };

  const openGradeBulkMessage = async (grade) => {
    const { data } = await supabase
      .from('students')
      .select('*, groups_table(name)')
      .eq('grade_id', grade.id);
    setBulkRecipients(
      (data || []).map((s) => ({ name: s.name, phone: s.parent_phone, groupName: s.groups_table?.name, gradeName: grade.name }))
    );
    setBulkTitle(`صف ${grade.name} (كل المجموعات)`);
    setBulkOpen(true);
  };

  if (profileLoading) return <div className="muted">جارِ التحميل...</div>;
  if (!isOwner) {
    return <EmptyState title="غير مصرح لك بالدخول هنا" hint="إدارة الصفوف والمجموعات للمدرس (صاحب الحساب) بس." />;
  }

  if (loading) return <div className="muted">جارِ التحميل...</div>;

  return (
    <div>
      <h2>الصفوف والمجموعات</h2>

      {grades.length === 0 && <div className="muted">لا توجد صفوف بعد — دوس ➕ عشان تضيف أول صف.</div>}

      {grades.map((grade) => {
        const newGroupForm = getNewGroupForm(grade.id);
        return (
          <div key={grade.id} className="card">
            {editingGradeId === grade.id ? (
              <div className="row">
                <input value={editGradeName} onChange={(e) => setEditGradeName(e.target.value)} style={{ flex: 2 }} />
                <input
                  type="number"
                  value={editGradeFee}
                  onChange={(e) => setEditGradeFee(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-sm" onClick={() => saveGradeEdit(grade.id)}>حفظ</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingGradeId(null)}>إلغاء</button>
              </div>
            ) : (
              <div className="row-between">
                <div>
                  <strong>{grade.name}</strong>{' '}
                  <span className="muted">— اشتراك شهري: {grade.monthly_fee}</span>
                </div>
                <div className="row">
                  <button
                    className="icon-action-btn"
                    style={{ color: '#16a34a' }}
                    title="رسالة جماعية للصف بالكامل"
                    onClick={() => openGradeBulkMessage(grade)}
                  >
                    <IconMessage size={17} />
                  </button>
                  <button
                    className="icon-action-btn icon-edit"
                    title="تعديل"
                    onClick={() => {
                      setEditingGradeId(grade.id);
                      setEditGradeName(grade.name);
                      setEditGradeFee(String(grade.monthly_fee));
                    }}
                  >
                    <IconPencil size={17} />
                  </button>
                  <button className="icon-action-btn icon-delete" title="حذف" onClick={() => deleteGrade(grade.id)}>
                    <IconTrash size={17} />
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 10, paddingRight: 12, borderRight: '2px solid #e5e7eb' }}>
              {(groupsByGrade[grade.id] || []).map((group) => (
                <div key={group.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f2f4' }}>
                  {editingGroupId === group.id ? (
                    <div>
                      <div className="row">
                        <input
                          value={editGroupForm.name}
                          onChange={(e) => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
                          style={{ flex: 1 }}
                        />
                        <input
                          type="time"
                          value={editGroupForm.start_time}
                          onChange={(e) => setEditGroupForm({ ...editGroupForm, start_time: e.target.value })}
                        />
                        <span className="muted">إلى</span>
                        <input
                          type="time"
                          value={editGroupForm.end_time}
                          onChange={(e) => setEditGroupForm({ ...editGroupForm, end_time: e.target.value })}
                        />
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <DaysPicker selectedDays={editGroupForm.days} onToggle={toggleEditGroupDay} />
                      </div>
                      <div className="row" style={{ marginTop: 6 }}>
                        <button className="btn btn-sm" onClick={() => saveGroupEdit(group.id)}>حفظ</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditingGroupId(null)}>إلغاء</button>
                      </div>
                    </div>
                  ) : (
                    <div className="row-between">
                      <div>
                        <span>{group.name}</span>
                        {scheduleLabel(group) && (
                          <div className="muted" style={{ fontSize: 12 }}>{scheduleLabel(group)}</div>
                        )}
                        {!loadingStats && groupStats[group.id] && (
                          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                            👥 {groupStats[group.id].studentCount} طالب
                            {groupStats[group.id].attendanceRate !== null && (
                              <> · 📊 حضور {groupStats[group.id].attendanceRate}%</>
                            )}
                            {groupStats[group.id].paidTotal > 0 && (
                              <> · 💰 {groupStats[group.id].paidCount}/{groupStats[group.id].paidTotal} دافعين</>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="row">
                        <button
                          className="icon-action-btn"
                          style={{ color: '#16a34a' }}
                          title="رسالة جماعية للمجموعة"
                          onClick={() => openGroupBulkMessage(group, grade.name)}
                        >
                          <IconMessage size={16} />
                        </button>
                        <button className="icon-action-btn icon-edit" title="تعديل" onClick={() => startEditGroup(group)}>
                          <IconPencil size={16} />
                        </button>
                        <button className="icon-action-btn icon-delete" title="حذف" onClick={() => deleteGroup(group.id)}>
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div style={{ marginTop: 8 }}>
                <div className="row">
                  <input
                    placeholder="اسم مجموعة جديدة"
                    value={newGroupForm.name}
                    onChange={(e) => updateNewGroupForm(grade.id, { name: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="time"
                    value={newGroupForm.start_time}
                    onChange={(e) => updateNewGroupForm(grade.id, { start_time: e.target.value })}
                  />
                  <span className="muted">إلى</span>
                  <input
                    type="time"
                    value={newGroupForm.end_time}
                    onChange={(e) => updateNewGroupForm(grade.id, { end_time: e.target.value })}
                  />
                </div>
                <div style={{ marginTop: 6 }}>
                  <DaysPicker selectedDays={newGroupForm.days} onToggle={(d) => toggleNewGroupDay(grade.id, d)} />
                </div>
                <Button size="sm" style={{ marginTop: 6 }} loading={addingGroupFor === grade.id} onClick={() => addGroup(grade.id)}>
                  إضافة مجموعة
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      <button className="fab" onClick={() => setAddGradeOpen(true)} title="إضافة صف جديد">+</button>

      <SlideUpModal open={addGradeOpen} onClose={() => setAddGradeOpen(false)} title="إضافة صف جديد">
        <form onSubmit={addGrade}>
          <div className="row">
            <input
              placeholder="اسم الصف الجديد"
              value={newGradeName}
              onChange={(e) => setNewGradeName(e.target.value)}
              style={{ flex: 2 }}
              autoFocus
            />
            <input
              type="number"
              placeholder="الاشتراك الشهري"
              value={newGradeFee}
              onChange={(e) => setNewGradeFee(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
          <Button type="submit" loading={addingGrade} style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
            إضافة الصف
          </Button>
        </form>
      </SlideUpModal>

      <BulkWhatsAppModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        recipients={bulkRecipients}
        title={bulkTitle}
      />
    </div>
  );
}
