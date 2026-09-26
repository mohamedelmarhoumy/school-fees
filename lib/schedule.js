import { WEEKDAY_LABELS, SATURDAY_FIRST_ORDER } from './constants';

/** يحوّل وقت من صيغة 24 ساعة (HH:MM أو HH:MM:SS) إلى صيغة 12 ساعة عربية (ص/م). */
export function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return '';
  const m = (mStr || '00').padStart(2, '0');
  const period = h >= 12 ? 'م' : 'ص';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
}

/** نص موجز لأيام ووقت المجموعة، مثال: "السبت، الاثنين | 1:00 م - 2:00 م" */
export function scheduleLabel(group) {
  const days = (group.days_of_week || [])
    .slice()
    .sort((a, b) => SATURDAY_FIRST_ORDER.indexOf(a) - SATURDAY_FIRST_ORDER.indexOf(b));
  if (days.length === 0 && !group.start_time) return null;
  const dayNames = days.map((d) => WEEKDAY_LABELS[d]).join('، ');
  let time = '';
  if (group.start_time && group.end_time) {
    time = `${formatTime12h(group.start_time)} - ${formatTime12h(group.end_time)}`;
  } else if (group.start_time) {
    time = formatTime12h(group.start_time);
  }
  return [dayNames, time].filter(Boolean).join(' | ');
}

export const DEFAULT_GRACE_PERIOD_MINUTES = 15;

/** مدة سماح التأخير الخاصة بالمجموعة (بالدقائق) — أو القيمة الافتراضية لو المجموعة معملتش تخصيص لها */
export function groupGracePeriodMinutes(group) {
  const v = group?.grace_period_minutes;
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_GRACE_PERIOD_MINUTES;
}

/**
 * يبني `Date` كامل بدمج تاريخ الجلسة (date: 'YYYY-MM-DD') مع وقت بداية المجموعة
 * (group.start_time: 'HH:MM' أو 'HH:MM:SS'). يرجّع null لو المجموعة معندهاش وقت بداية محدد،
 * وفي الحالة دي منقدرش نحسب "تأخير" فبيفضل كل مسح بيتسجّل "حاضر".
 */
export function sessionStartDateTime(group, dateStr) {
  if (!group?.start_time || !dateStr) return null;
  const [hStr, mStr] = group.start_time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (isNaN(h)) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * الحالة اللي المفروض الطالب ياخدها لو اتمسح دلوقتي: 'present' لو المسح تم قبل أو عند
 * (وقت بداية الحصة + مدة السماح)، و'late' لو اتأخر عن كده. لو مفيش وقت بداية محدد
 * للمجموعة أصلاً، بيرجّع 'present' دايماً لأنه مفيش أساس نقيس عليه التأخير.
 */
export function resolveScanStatus(group, dateStr, scanTime = new Date()) {
  const start = sessionStartDateTime(group, dateStr);
  if (!start) return 'present';
  const graceMs = groupGracePeriodMinutes(group) * 60 * 1000;
  return scanTime.getTime() <= start.getTime() + graceMs ? 'present' : 'late';
}
