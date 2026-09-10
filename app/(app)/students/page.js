'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const emptyForm = { name: '', student_number: '', parent_phone: '', grade_id: '', group_id: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: studentsData }, { data: gradesData }, { data: groupsData }] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('grades').select('*').order('name'),
      supabase.from('groups_table').select('*').order('name'),
    ]);
    setStudents(studentsData || []);
    setGrades(gradesData || []);
    setGroups(groupsData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const groupsForGrade = (gradeId) => groups.filter((g) => g.grade_id === gradeId);
  const gradeName = (id) => grades.find((g) => g.id === id)?.name || '—';
  const groupName = (id) => groups.find((g) => g.id === id)?.name || '—';

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      student_number: form.student_number.trim() || null,
      parent_phone: form.parent_phone.trim() || null,
      grade_id: form.grade_id || null,
      group_id: form.group_id || null,
    };
    if (editingId) {
      await supabase.from('students').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
    } else {
      await supabase.from('students').insert(payload);
    }
    resetForm();
    loadAll();
  };

  const startEdit = (student) => {
    setEditingId(student.id);
    setForm({
      name: student.name,
      student_number: student.student_number || '',
      parent_phone: student.parent_phone || '',
      grade_id: student.grade_id || '',
      group_id: student.group_id || '',
    });
  };

  const deleteStudent = async (id) => {
    if (!confirm('حذف هذا الطالب نهائياً مع كل سجلاته؟')) return;
    await supabase.from('students').delete().eq('id', id);
    loadAll();
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.student_number || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="muted">جارِ التحميل...</div>;

  return (
    <div>
      <h2>الطلاب</h2>

      <form onSubmit={handleSubmit} className="card">
        <div className="row">
          <input
            placeholder="اسم الطالب"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ flex: 2 }}
            required
          />
          <input
            placeholder="رقم الطالب"
            value={form.student_number}
            onChange={(e) => setForm({ ...form, student_number: e.target.value })}
            style={{ flex: 1 }}
          />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            placeholder="رقم ولي الأمر (واتساب)"
            value={form.parent_phone}
            onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
            style={{ flex: 1 }}
          />
          <select
            value={form.grade_id}
            onChange={(e) => setForm({ ...form, grade_id: e.target.value, group_id: '' })}
            style={{ flex: 1 }}
          >
            <option value="">اختر الصف</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select
            value={form.group_id}
            onChange={(e) => setForm({ ...form, group_id: e.target.value })}
            style={{ flex: 1 }}
            disabled={!form.grade_id}
          >
            <option value="">اختر المجموعة</option>
            {groupsForGrade(form.grade_id).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button type="submit" className="btn">{editingId ? 'حفظ التعديل' : 'إضافة طالب'}</button>
          {editingId && (
            <button type="button" className="btn btn-outline" onClick={resetForm}>إلغاء</button>
          )}
        </div>
      </form>

      <input
        placeholder="بحث بالاسم أو رقم الطالب..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 10 }}
      />

      {filtered.length === 0 && <div className="muted">لا يوجد طلاب مطابقين.</div>}

      {filtered.map((student) => (
        <div key={student.id} className="card row-between">
          <Link href={`/students/${student.id}`}>
            <div style={{ fontWeight: 600 }}>{student.name}</div>
            <div className="muted">
              {gradeName(student.grade_id)} / {groupName(student.group_id)}
              {student.student_number ? ` — رقم: ${student.student_number}` : ''}
            </div>
          </Link>
          <div className="row">
            <button className="btn btn-outline btn-sm" onClick={() => startEdit(student)}>تعديل</button>
            <button className="btn btn-danger btn-sm" onClick={() => deleteStudent(student.id)}>حذف</button>
          </div>
        </div>
      ))}
    </div>
  );
}
