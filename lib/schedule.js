import { WEEKDAY_LABELS } from './constants';

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
  const days = (group.days_of_week || []).slice().sort((a, b) => a - b);
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
