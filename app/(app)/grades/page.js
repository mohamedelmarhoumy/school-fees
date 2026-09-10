'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function GradesPage() {
  const [grades, setGrades] = useState([]);
  const [groupsByGrade, setGroupsByGrade] = useState({});
  const [loading, setLoading] = useState(true);
  const [newGradeName, setNewGradeName] = useState('');
  const [newGradeFee, setNewGradeFee] = useState('');
  const [newGroupNameByGrade, setNewGroupNameByGrade] = useState({});
  const [editingGradeId, setEditingGradeId] = useState(null);
  const [editGradeName, setEditGradeName] = useState('');
  const [editGradeFee, setEditGradeFee] = useState('');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');

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
    await supabase.from('grades').insert({
      name: newGradeName.trim(),
      monthly_fee: Number(newGradeFee) || 0,
    });
    setNewGradeName('');
    setNewGradeFee('');
    loadAll();
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

  const addGroup = async (gradeId) => {
    const name = (newGroupNameByGrade[gradeId] || '').trim();
    if (!name) return;
    await supabase.from('groups_table').insert({ grade_id: gradeId, name });
    setNewGroupNameByGrade((s) => ({ ...s, [gradeId]: '' }));
    loadAll();
  };

  const saveGroupEdit = async (id) => {
    await supabase
      .from('groups_table')
      .update({ name: editGroupName.trim(), updated_at: new Date().toISOString() })
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
        <button type="submit" className="btn">إضافة صف</button>
      </form>

      {grades.length === 0 && <div className="muted">لا توجد صفوف بعد — أضف أول صف فوق.</div>}

      {grades.map((grade) => (
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
              <div key={group.id} className="row-between" style={{ padding: '6px 0' }}>
                {editingGroupId === group.id ? (
                  <div className="row" style={{ flex: 1 }}>
                    <input
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-sm" onClick={() => saveGroupEdit(group.id)}>حفظ</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditingGroupId(null)}>إلغاء</button>
                  </div>
                ) : (
                  <>
                    <span>{group.name}</span>
                    <div className="row">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setEditingGroupId(group.id);
                          setEditGroupName(group.name);
                        }}
                      >
                        تعديل
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteGroup(group.id)}>حذف</button>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div className="row" style={{ marginTop: 6 }}>
              <input
                placeholder="اسم مجموعة جديدة"
                value={newGroupNameByGrade[grade.id] || ''}
                onChange={(e) => setNewGroupNameByGrade((s) => ({ ...s, [grade.id]: e.target.value }))}
                style={{ flex: 1 }}
              />
              <button className="btn btn-sm" onClick={() => addGroup(grade.id)}>إضافة مجموعة</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
