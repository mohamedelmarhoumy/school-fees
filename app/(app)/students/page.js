'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import Button from '../../../lib/Button';
import { SkeletonCards } from '../../../lib/Skeleton';
import EmptyState from '../../../lib/EmptyState';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const emptyForm = { name: '', student_number: '', parent_phone: '', grade_id: '', group_id: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

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

  // سيريال تلقائي: رقم الطالب داخل نفس المجموعة (لا يمكن إدخاله يدوياً)
  useEffect(() => {
    const computeSerial = async () => {
      if (editingId || !form.group_id) return;
      const { data } = await supabase.from('students').select('student_number').eq('group_id', form.group_id);
      const nums = (data || []).map((s) => parseInt(s.student_number, 10)).filter((n) => !isNaN(n));
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      setForm((f) => ({ ...f, student_number: String(next) }));
    };
    computeSerial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.group_id, editingId]);

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
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      student_number: form.student_number || null,
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
    await loadAll();
    setSaving(false);
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
            placeholder="رقم الطالب (تلقائي)"
            value={form.student_number ? `#${form.student_number}` : 'اختر المجموعة أولاً'}
            disabled
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
          <Button type="submit" loading={saving}>{editingId ? 'حفظ التعديل' : 'إضافة طالب'}</Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={resetForm}>إلغاء</Button>
          )}
        </div>
      </form>

      <input
        placeholder="بحث بالاسم أو رقم الطالب..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 10 }}
      />

      {loading && <SkeletonCards count={5} />}

      {!loading && filtered.length === 0 && <EmptyState title="لا يوجد طلاب مطابقين" />}

      {!loading && filtered.map((student) => (
        <div key={student.id} className="card row-between">
          <Link href={`/students/${student.id}`}>
            <div style={{ fontWeight: 600 }}>
              {student.student_number ? `#${student.student_number} — ` : ''}{student.name}
            </div>
            <div className="muted">
              {gradeName(student.grade_id)} / {groupName(student.group_id)}
            </div>
          </Link>
          <div className="row">
            <Button variant="outline" size="sm" onClick={() => startEdit(student)}>تعديل</Button>
            <Button variant="danger" size="sm" onClick={() => deleteStudent(student.id)}>حذف</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
