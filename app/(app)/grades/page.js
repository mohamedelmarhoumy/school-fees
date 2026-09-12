'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { WEEKDAY_LABELS } from '../../../lib/constants';
import { scheduleLabel } from '../../../lib/schedule';
import Button from '../../../lib/Button';

const emptyGroupForm = { name: '', days: [], start_time: '', end_time: '' };

function DaysPicker({ selectedDays, onToggle }) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
      {WEEKDAY_LABELS.map((label, index) => (
        <button
          key={index}
          type="button"
          className="btn btn-sm"
          onClick={() => onToggle(index)}
          style={{
            background: selectedDays.includes(index) ? '#2563eb' : 'white',
            color: selectedDays.includes(index) ? 'white' : '#2563eb',
            border: '1px solid #2563eb',
          }}
        >
          {label}
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
  }, []);

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

  if (loading) return <div className="muted">جارِ التحميل...</div>;

  return (
    <div>
      <h2>الصفوف والمجموعات</h2>

      <form onSubmit={addGrade} className="card row">
        <input
          placeholder="اسم الصف الجديد"
          value={newGradeName}
          onChange={(e) => setNewGradeName(e.target.value)}
          style={{ flex: 2 }}
        />
        <input
          type="number"
          placeholder="الاشتراك الشهري"
          value={newGradeFee}
          onChange={(e) => setNewGradeFee(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button type="submit" loading={addingGrade}>إضافة صف</Button>
      </form>

      {grades.length === 0 && <div className="muted">لا توجد صفوف بعد — أضف أول صف فوق.</div>}

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
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setEditingGradeId(grade.id);
                      setEditGradeName(grade.name);
                      setEditGradeFee(String(grade.monthly_fee));
                    }}
                  >
                    تعديل
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteGrade(grade.id)}>حذف</button>
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
                      </div>
                      <div className="row">
                        <button className="btn btn-outline btn-sm" onClick={() => startEditGroup(group)}>تعديل</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteGroup(group.id)}>حذف</button>
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
    </div>
  );
}
