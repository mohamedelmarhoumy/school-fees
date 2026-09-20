'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { WEEKDAY_LABELS, ARABIC_MONTHS } from '../../../lib/constants';
import { formatTime12h } from '../../../lib/schedule';
import { SkeletonCards } from '../../../lib/Skeleton';
import EmptyState from '../../../lib/EmptyState';

const todayStr = () => new Date().toISOString().slice(0, 10);

function toMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatRemaining(minutes) {
  if (minutes === null) return '';
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs} د`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m > 0 ? `${h}س ${m}د` : `${h}س`;
}

export default function DashboardPage() {
  const [todaysGroups, setTodaysGroups] = useState([]);
  const [groupStats, setGroupStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date();
      const todayWeekday = now.getDay();
      const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

      const [{ data: groups }, { data: students }, { data: payments }] = await Promise.all([
        supabase.from('groups_table').select('*, grades(name)'),
        supabase.from('students').select('id, group_id'),
        supabase.from('payments').select('student_id, status').eq('year', now.getFullYear()).eq('month', now.getMonth() + 1),
      ]);

      const todays = (groups || [])
        .filter((g) => (g.days_of_week || []).includes(todayWeekday))
        // اشيل المجموعة اللي فات معادها (وقت انتهائها قبل الوقت الحالي)
        .filter((g) => !g.end_time || g.end_time >= nowTimeStr)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      setTodaysGroups(todays);

      const groupByStudent = {};
      const studentCountByGroup = {};
      (students || []).forEach((s) => {
        if (!s.group_id) return;
        groupByStudent[s.id] = s.group_id;
        studentCountByGroup[s.group_id] = (studentCountByGroup[s.group_id] || 0) + 1;
      });

      const paidByStudent = {};
      (payments || []).forEach((p) => {
        paidByStudent[p.student_id] = p.status;
      });

      const unpaidByGroup = {};
      Object.keys(groupByStudent).forEach((studentId) => {
        const gid = groupByStudent[studentId];
        const status = paidByStudent[studentId] || 'unpaid';
        if (status !== 'paid') {
          unpaidByGroup[gid] = (unpaidByGroup[gid] || 0) + 1;
        }
      });

      const stats = {};
      todays.forEach((g) => {
        stats[g.id] = {
          studentCount: studentCountByGroup[g.id] || 0,
          unpaidCount: unpaidByGroup[g.id] || 0,
        };
      });
      setGroupStats(stats);
      setLoading(false);
    };
    load();

    const interval = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date();

  return (
    <div>
      <div className="date-banner">
        <div className="weekday">{WEEKDAY_LABELS[today.getDay()]}</div>
        <div className="full-date">
          {today.getDate()} {ARABIC_MONTHS[today.getMonth()]} {today.getFullYear()}
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>مجموعات اليوم ({todaysGroups.length})</h3>
        <Link href="/schedule" className="muted" style={{ fontSize: 12.5 }}>الجدول الأسبوعي ←</Link>
      </div>

      {loading && <SkeletonCards count={3} />}

      {!loading && todaysGroups.length === 0 && (
        <div className="card">
          <EmptyState title="لا توجد مجموعات مجدولة اليوم" hint="أضف مواعيد للمجموعات من شاشة الصفوف." />
        </div>
      )}

      {!loading &&
        todaysGroups.map((g) => {
          const startMin = toMinutes(g.start_time);
          const endMin = toMinutes(g.end_time);
          const isLive = startMin !== null && endMin !== null && nowMinutes >= startMin && nowMinutes <= endMin;
          const isUpcoming = startMin !== null && nowMinutes < startMin;
          const progressPct = isLive ? Math.min(100, Math.max(0, ((nowMinutes - startMin) / (endMin - startMin)) * 100)) : 0;
          const remainingLabel = isLive
            ? `باقي ${formatRemaining(endMin - nowMinutes)}`
            : isUpcoming
            ? `بعد ${formatRemaining(startMin - nowMinutes)}`
            : '';
          const stats = groupStats[g.id] || { studentCount: 0, unpaidCount: 0 };

          return (
            <Link key={g.id} href={`/attendance?groupId=${g.id}&date=${todayStr()}`} className="group-card">
              <div className="row-between">
                <strong>{g.grades?.name} — {g.name}</strong>
                {(isLive || isUpcoming) && (
                  <span className="badge" style={{ background: isLive ? '#16a34a' : 'var(--accent)' }}>
                    {isLive ? 'مباشر' : 'قادمة'}
                  </span>
                )}
              </div>
              <div className="muted group-card-details">
                👥 {stats.studentCount} طالب
                {g.start_time && (
                  <> • ⏰ {formatTime12h(g.start_time)}{g.end_time ? ` - ${formatTime12h(g.end_time)}` : ''}</>
                )}
                {stats.unpaidCount > 0 && <> • ⚠️ {stats.unpaidCount} مدفعش</>}
              </div>
              {startMin !== null && endMin !== null && (
                <div style={{ marginTop: 8 }}>
                  <div className="row-between" style={{ fontSize: 11 }}>
                    <span className="muted">{formatTime12h(g.start_time)}</span>
                    <span className="muted">{remainingLabel}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}
            </Link>
          );
        })}
    </div>
  );
}
