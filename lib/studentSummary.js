/** يفكّ تاريخ بصيغة YYYY-MM-DD لسنة وشهر كأرقام — بدل ما نعتمد على new Date()
 * اللي ممكن تفسّر التاريخ بتوقيت UTC وتزحزحه يوم لقدّام أو لورا حسب التوقيت المحلي. */
function parseDateParts(dateStr) {
  const [y, m] = String(dateStr || '').split('-').map((n) => parseInt(n, 10));
  return { year: y, month: m };
}

/** ملخص حضور الطالب في شهر/سنة معيّنة: حاضر + متأخر تُحسب كتواجد فعلي في نسبة الحضور. */
export function monthlyAttendanceSummary(attendanceRows, year, month) {
  const rows = (attendanceRows || []).filter((a) => {
    const { year: y, month: m } = parseDateParts(a.date);
    return y === year && m === month;
  });
  const present = rows.filter((a) => a.status === 'present').length;
  const late = rows.filter((a) => a.status === 'late').length;
  const absent = rows.filter((a) => a.status === 'absent').length;
  const total = rows.length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : null;
  return { total, present, late, absent, rate };
}

/** بيدوّر على سجل الاشتراك لشهر/سنة معيّنة من قائمة الاشتراكات. */
export function currentMonthPayment(payments, year, month) {
  return (payments || []).find((p) => p.year === year && p.month === month) || null;
}

/** ملخص عام لدرجات الكويزات/الواجبات: عدد الاختبارات، مجموع الدرجات، والنسبة المئوية العامة. */
export function scoresSummary(scoreRows) {
  const rows = scoreRows || [];
  const totalScore = rows.reduce((sum, r) => sum + Number(r.score || 0), 0);
  const totalMax = rows.reduce((sum, r) => sum + Number(r.max_score || 0), 0);
  const percent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;
  return { count: rows.length, totalScore, totalMax, percent };
}
