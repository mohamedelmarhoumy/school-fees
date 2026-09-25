'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { supabase } from '../../../lib/supabaseClient';
import { scheduleLabel } from '../../../lib/schedule';
import Button from '../../../lib/Button';
import { SkeletonCards } from '../../../lib/Skeleton';
import EmptyState from '../../../lib/EmptyState';
import { useProfile } from '../../../lib/useProfile';
import { logActivity } from '../../../lib/activityLog';
import { parseCsv } from '../../../lib/csvImport';
import { downloadCsv } from '../../../lib/exportCsv';
import { buildWhatsAppLink } from '../../../lib/whatsapp';
import { IconPencil, IconTrash } from '../../../lib/icons';
import SlideUpModal from '../../../lib/SlideUpModal';

async function fetchStudentsPageData() {
  const [{ data: studentsData }, { data: gradesData }, { data: groupsData }] = await Promise.all([
    supabase.from('students').select('*').order('name'),
    supabase.from('grades').select('*').order('name'),
    supabase.from('groups_table').select('*').order('name'),
  ]);
  return { students: studentsData || [], grades: gradesData || [], groups: groupsData || [] };
}

export default function StudentsPage() {
  // ⚡ SWR: أول ما الشاشة تتفتح بتعرض فوراً آخر نسخة متخزّنة محلياً (حتى بدون
  // نت)، وفي نفس الوقت بتطلب نسخة جديدة من السيرفر بهدوء في الخلفية.
  const { data, isLoading, mutate } = useSWR('students-page-index', fetchStudentsPageData);
  const students = data?.students || [];
  const grades = data?.grades || [];
  const groups = data?.groups || [];
  const loading = isLoading && !data;
  const loadAll = () => mutate();

  const [search, setSearch] = useState('');

  const emptyForm = { name: '', student_number: '', parent_phone: '', grade_id: '', group_id: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const { profile, isOwner } = useProfile();
  const canEdit = isOwner || !!profile?.can_students;
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [justAdded, setJustAdded] = useState(null);
  const [addStudentOpen, setAddStudentOpen] = useState(false);

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
    const actorName = profile?.display_name || profile?.email;
    if (editingId) {
      await supabase.from('students').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
      logActivity(actorName, 'student_updated', `تعديل بيانات: ${payload.name}`);
    } else {
      await supabase.from('students').insert(payload);
      logActivity(actorName, 'student_added', `إضافة طالب جديد: ${payload.name}`);
      const gradeInfo = grades.find((g) => g.id === payload.grade_id);
      setJustAdded({ ...payload, gradeName: gradeInfo?.name, monthlyFee: gradeInfo?.monthly_fee });
    }
    resetForm();
    await loadAll();
    setSaving(false);
    setAddStudentOpen(false);
  };

  const startEdit = (student) => {
    setJustAdded(null);
    setEditingId(student.id);
    setForm({
      name: student.name,
      student_number: student.student_number || '',
      parent_phone: student.parent_phone || '',
      grade_id: student.grade_id || '',
      group_id: student.group_id || '',
    });
  };

  const deleteStudent = async (id, name) => {
    if (!confirm('حذف هذا الطالب نهائياً مع كل سجلاته؟')) return;
    await supabase.from('students').delete().eq('id', id);
    logActivity(profile?.display_name || profile?.email, 'student_deleted', `حذف طالب: ${name}`);
    loadAll();
  };

  const downloadTemplate = () => {
    downloadCsv(
      'نموذج-استيراد-الطلاب.csv',
      ['الاسم', 'رقم ولي الأمر', 'اسم الصف', 'اسم المجموعة'],
      [['أحمد محمد', '01012345678', 'الأول الابتدائي', 'مجموعة أ']]
    );
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // يسمح باختيار نفس الملف تاني لو حبيت تعيد المحاولة
    if (!file) return;

    setImporting(true);
    setImportSummary(null);

    const text = await file.text();
    const rows = parseCsv(text).slice(1); // تجاهل صف العناوين

    const nextSerialByGroup = {};
    students.forEach((s) => {
      const n = parseInt(s.student_number, 10);
      if (s.group_id && !isNaN(n)) {
        nextSerialByGroup[s.group_id] = Math.max(nextSerialByGroup[s.group_id] || 0, n);
      }
    });

    const toInsert = [];
    const failed = [];

    for (const row of rows) {
      const [name, phone, gradeName, groupName] = row;
      if (!name || !name.trim()) continue;

      let gradeId = null;
      let groupId = null;

      if (gradeName && gradeName.trim()) {
        const matchedGrade = grades.find((g) => g.name.trim().toLowerCase() === gradeName.trim().toLowerCase());
        if (!matchedGrade) {
          failed.push({ name, reason: `الصف "${gradeName}" مش موجود` });
          continue;
        }
        gradeId = matchedGrade.id;

        if (groupName && groupName.trim()) {
          const matchedGroup = groupsForGrade(gradeId).find(
            (g) => g.name.trim().toLowerCase() === groupName.trim().toLowerCase()
          );
          if (!matchedGroup) {
            failed.push({ name, reason: `المجموعة "${groupName}" مش موجودة في صف "${gradeName}"` });
            continue;
          }
          groupId = matchedGroup.id;
        }
      }

      let studentNumber = null;
      if (groupId) {
        const next = (nextSerialByGroup[groupId] || 0) + 1;
        nextSerialByGroup[groupId] = next;
        studentNumber = String(next);
      }

      toInsert.push({
        name: name.trim(),
        parent_phone: (phone || '').trim() || null,
        grade_id: gradeId,
        group_id: groupId,
        student_number: studentNumber,
      });
    }

    if (toInsert.length > 0) {
      await supabase.from('students').insert(toInsert);
      logActivity(
        profile?.display_name || profile?.email,
        'student_added',
        `استيراد جماعي: ${toInsert.length} طالب`
      );
    }

    setImportSummary({ successCount: toInsert.length, failed });
    await loadAll();
    setImporting(false);
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.student_number || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h2>الطلاب</h2>

      {justAdded && (
        <div className="card" style={{ borderRight: '3px solid #16a34a' }}>
          <div className="row-between">
            <strong>✓ اتضاف {justAdded.name}</strong>
            <button className="icon-btn" onClick={() => setJustAdded(null)}>✕</button>
          </div>
          {justAdded.parent_phone ? (
            <>
              <div className="muted" style={{ marginTop: 6 }}>ابعت رسالة ترحيب لولي الأمر؟</div>
              <div style={{ marginTop: 8 }}>
                <Button
                  as="a"
                  variant="whatsapp"
                  size="sm"
                  href={buildWhatsAppLink(
                    justAdded.parent_phone,
                    `أهلاً بيكم! الطالب ${justAdded.name} اتسجّل معانا${justAdded.gradeName ? ` في ${justAdded.gradeName}` : ''}.${
                      justAdded.monthlyFee ? ` الاشتراك الشهري: ${justAdded.monthlyFee} جنيه.` : ''
                    } تقدروا تتابعوا معانا أول بأول، وأهلاً وسهلاً بيكم.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setJustAdded(null)}
                >
                  إرسال رسالة ترحيب عبر واتساب
                </Button>
              </div>
            </>
          ) : (
            <div className="muted" style={{ marginTop: 6 }}>مفيش رقم ولي أمر مسجّل لإرسال ترحيب.</div>
          )}
        </div>
      )}

      {canEdit && (
        <div className="card">
          <div className="row-between">
            <strong>استيراد الطلاب من ملف</strong>
            <Button variant="outline" size="sm" onClick={() => setImportOpen((o) => !o)}>
              {importOpen ? 'إخفاء' : '📥 استيراد'}
            </Button>
          </div>
          {importOpen && (
            <div style={{ marginTop: 10 }}>
              <div className="muted">
                الملف لازم يكون CSV بترتيب الأعمدة: الاسم، رقم ولي الأمر، اسم الصف، اسم المجموعة (اسم الصف والمجموعة لازم يطابقوا الموجود عندك بالظبط).
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>تنزيل نموذج فارغ</Button>
                <label className="btn2 btn2-primary btn2-sm" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                  {importing ? 'جارِ الاستيراد...' : 'اختيار ملف CSV'}
                  <input type="file" accept=".csv" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
                </label>
              </div>
              {importSummary && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ color: '#16a34a', fontWeight: 600 }}>✓ تم استيراد {importSummary.successCount} طالب بنجاح</div>
                  {importSummary.failed.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div className="error-text">تعذّر استيراد {importSummary.failed.length} صف:</div>
                      {importSummary.failed.map((f, i) => (
                        <div key={i} className="muted" style={{ fontSize: 12.5 }}>{f.name} — {f.reason}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {canEdit && (
      <SlideUpModal
        open={addStudentOpen || !!editingId}
        onClose={() => {
          resetForm();
          setAddStudentOpen(false);
        }}
        title={editingId ? 'تعديل بيانات طالب' : 'إضافة طالب جديد'}
      >
        <form onSubmit={handleSubmit}>
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
              <option key={g.id} value={g.id}>
                {g.name}{scheduleLabel(g) ? ` — ${scheduleLabel(g)}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <Button type="submit" loading={saving} style={{ flex: 1, justifyContent: 'center' }}>
            {editingId ? 'حفظ التعديل' : 'إضافة طالب'}
          </Button>
        </div>
        </form>
      </SlideUpModal>
      )}

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
            {canEdit && (
              <>
                <button className="icon-action-btn icon-edit" title="تعديل" onClick={() => startEdit(student)}>
                  <IconPencil size={17} />
                </button>
                <button className="icon-action-btn icon-delete" title="حذف" onClick={() => deleteStudent(student.id, student.name)}>
                  <IconTrash size={17} />
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      {canEdit && (
        <button className="fab" onClick={() => setAddStudentOpen(true)} title="إضافة طالب جديد">+</button>
      )}
    </div>
  );
}
