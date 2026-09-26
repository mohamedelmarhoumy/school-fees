'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { WEEKDAY_LABELS, ARABIC_MONTHS } from '../../../lib/constants';
import { formatTime12h } from '../../../lib/schedule';
import { SkeletonCards } from '../../../lib/Skeleton';
import EmptyState from '../../../lib/EmptyState';
import { useProfile } from '../../../lib/useProfile';
import GroupUnpaidModal from '../../../lib/GroupUnpaidModal';
import { monthlyAttendanceSummary } from '../../../lib/studentSummary';
import { IconWallet, IconCheckClipboard, IconUsers, IconCalendar } from '../../../lib/icons';

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

/** صيغة طويلة للوقت المتبقي، تُستخدم في جملة الترحيب أعلى الشاشة. */
function formatRemainingLong(minutes) {
  const abs = Math.max(0, Math.round(minutes));
  if (abs < 1) return 'أقل من دقيقة';
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const hourWord = h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : `${h} ساعات`;
  const minWord = m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : `${m} دقيقة`;
  if (h > 0 && m > 0) return `${hourWord} و${minWord}`;
  if (h > 0) return hourWord;
  return minWord;
}

function greetingWord() {
  const hour = new Date().getHours();
  return hour < 12 ? 'صباح الخير' : 'مساء الخير';
}

export default function DashboardPage() {
  const [todaysGroups, setTodaysGroups] = useState([]);
  const [groupStats, setGroupStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [homeStats, setHomeStats] = useState({ collectedThisMonth: 0, attendanceRate: null, studentsToday: 0 });
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  const { profile, isOwner } = useProfile();
  const canManagePayments = isOwner || !!profile?.can_payments;
  const [unpaidModal, setUnpaidModal] = useState(null); // { groupId, groupName }

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const todayWeekday = now.getDay();
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const [{ data: groups }, { data: students }, { data: payments }, { data: monthPayments }, { data: attendanceRows }] = await Promise.all([
      supabase.from('groups_table').select('*, grades(name)'),
      supabase.from('students').select('id, group_id'),
      supabase.from('payments').select('student_id, status').eq('year', now.getFullYear()).eq('month', now.getMonth() + 1),
      supabase.from('payments').select('amount_paid, discount_amount').eq('year', now.getFullYear()).eq('month', now.getMonth() + 1),
      supabase.from('attendance').select('status, date').gte('date', monthStart),
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
    let studentsTodayCount = 0;
    todays.forEach((g) => {
      const count = studentCountByGroup[g.id] || 0;
      stats[g.id] = {
        studentCount: count,
        unpaidCount: unpaidByGroup[g.id] || 0,
      };
      studentsTodayCount += count;
    });
    setGroupStats(stats);

    const collectedThisMonth = (monthPayments || []).reduce(
      (sum, p) => sum + Number(p.amount_paid || 0) + Number(p.discount_amount || 0),
      0
    );
    const { rate } = monthlyAttendanceSummary(attendanceRows, now.getFullYear(), now.getMonth() + 1);

    setHomeStats({ collectedThisMonth, attendanceRate: rate, studentsToday: studentsTodayCount });
    setLoading(false);
  };

  useEffect(() => {
    load();

    const interval = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();
  const firstName = (profile?.display_name || '').trim().split(' ')[0] || '';

  // أقرب مجموعة قادمة (لسه معادها ما جاش) عشان جملة الترحيب.
  const upcomingGroups = todaysGroups.filter((g) => {
    const startMin = toMinutes(g.start_time);
    return startMin !== null && nowMinutes < startMin;
  });
  const nextUpcoming = upcomingGroups[0];
  const nextUpcomingRemaining = nextUpcoming ? toMinutes(nextUpcoming.start_time) - nowMinutes : null;

  return (
    <div>
      <div className="dash-hero">
        <div className="dash-hero-date">
          {WEEKDAY_LABELS[today.getDay()]}، {today.getDate()} {ARABIC_MONTHS[today.getMonth()]} {today.getFullYear()}
        </div>
        <div className="dash-hero-title">
          {greetingWord()}{firstName ? `، أ. ${firstName}` : ''}
        </div>
        <div className="dash-hero-sub">
          {todaysGroups.length > 0
            ? (
              <>
                لديك {todaysGroups.length} {todaysGroups.length === 1 ? 'مجموعة' : 'مجموعات'} قادمة اليوم
                {nextUpcoming ? `، أولها بعد ${formatRemainingLong(nextUpcomingRemaining)}.` : '.'}
              </>
            )
            : 'لا توجد مجموعات مجدولة اليوم.'}
        </div>
      </div>

      <div className="dash-stats-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span>تحصيل الشهر</span>
            <span className="dash-stat-icon"><IconWallet size={13} /></span>
          </div>
          <div className="dash-stat-value">
            {Math.round(homeStats.collectedThisMonth).toLocaleString('ar-EG')}
            <span className="dash-stat-unit">ج.م</span>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span>نسبة الحضور</span>
            <span className="dash-stat-icon"><IconCheckClipboard size={13} /></span>
          </div>
          <div className="dash-stat-value">
            {homeStats.attendanceRate === null ? '—' : homeStats.attendanceRate}
            {homeStats.attendanceRate !== null && <span className="dash-stat-unit">%</span>}
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span>طلاب اليوم</span>
            <span className="dash-stat-icon"><IconUsers size={13} /></span>
          </div>
          <div className="dash-stat-value">{homeStats.studentsToday}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span>مجموعات اليوم</span>
            <span className="dash-stat-icon"><IconCalendar size={13} /></span>
          </div>
          <div className="dash-stat-value">{todaysGroups.length}</div>
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 8 }}>
        <h3 className="dash-section-title">مجموعات اليوم ({todaysGroups.length})</h3>
        <Link href="/schedule" className="muted" style={{ fontSize: 12.5 }}>الجدول الأسبوعي ←</Link>
      </div>

      {loading && <SkeletonCards count={3} />}

      {!loading && todaysGroups.length === 0 && (
        <div className="card">
          <EmptyState title="لا توجد مجموعات مجدولة اليوم" hint="أضف مواعيد للمجموعات من شاشة الصفوف." />
        </div>
      )}

      {!loading && todaysGroups.length > 0 && (
        <div className="groups-grid">
          {todaysGroups.map((g) => {
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
              <Link
                key={g.id}
                href={`/attendance?groupId=${g.id}&date=${todayStr()}`}
                className={`group-card${isLive ? ' is-live' : ''}`}
              >
                <div className="row-between group-card-head">
                  <div className="row" style={{ gap: 8 }}>
                    {g.start_time && (
                      <div className="group-time-box">
                        <div className="group-time-value">{formatTime12h(g.start_time).split(' ')[0]}</div>
                        <div className="group-time-unit">{formatTime12h(g.start_time).split(' ')[1]}</div>
                      </div>
                    )}
                    <div className="group-card-title-block">
                      <div className="group-title">{g.grades?.name} — {g.name}</div>
                    </div>
                  </div>
                  {(isLive || isUpcoming) && (
                    <span className={`badge-soft ${isLive ? 'badge-soft-live' : 'badge-soft-upcoming'}`}>
                      {isLive ? 'مباشر' : 'قادمة'}
                    </span>
                  )}
                </div>
                <div className="muted group-card-details row" style={{ gap: 6 }}>
                  {g.start_time && (
                    <span>⏰ {formatTime12h(g.start_time)}{g.end_time ? ` - ${formatTime12h(g.end_time)}` : ''}</span>
                  )}
                  <span>👥 {stats.studentCount} طالب</span>
                  {stats.unpaidCount > 0 && (
                    canManagePayments ? (
                      <button
                        type="button"
                        className="unpaid-badge"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setUnpaidModal({ groupId: g.id, groupName: `${g.grades?.name} — ${g.name}` });
                        }}
                      >
                        ⚠️ {stats.unpaidCount} مدفعش
                      </button>
                    ) : (
                      <span>⚠️ {stats.unpaidCount} مدفعش</span>
                    )
                  )}
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
      )}

      <GroupUnpaidModal
        open={!!unpaidModal}
        onClose={() => setUnpaidModal(null)}
        groupId={unpaidModal?.groupId}
        groupName={unpaidModal?.groupName}
        onChanged={load}
      />
    </div>
  );
}
