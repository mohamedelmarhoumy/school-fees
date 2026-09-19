'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { WEEKDAY_LABELS } from '../../../lib/constants';
import { formatTime12h } from '../../../lib/schedule';
import { SkeletonCards } from '../../../lib/Skeleton';
import EmptyState from '../../../lib/EmptyState';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function SchedulePage() {
  const [byDay, setByDay] = useState({});
  const [loading, setLoading] = useState(true);
  const today = new Date().getDay();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: groups } = await supabase.from('groups_table').select('*, grades(name)');
      const grouped = {};
      (groups || []).forEach((g) => {
        (g.days_of_week || []).forEach((day) => {
          if (!grouped[day]) grouped[day] = [];
          grouped[day].push(g);
        });
      });
      Object.keys(grouped).forEach((day) => {
        grouped[day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      });
      setByDay(grouped);
      setLoading(false);
    };
    load();
  }, []);

  // الأسبوع عندنا يبدأ بالسبت وينتهي بالجمعة. وعشان يبقى عملي أكتر،
  // العرض بيبدأ بالنهاردة أولاً وبعدين باقي الأيام بالترتيب بعده، لحد ما
  // يلف على نفس ترتيب الأسبوع (سبت -> جمعة).
  const SATURDAY_FIRST_WEEK = [6, 0, 1, 2, 3, 4, 5];
  const todayIndexInWeek = SATURDAY_FIRST_WEEK.indexOf(today);
  const orderedDays = [
    ...SATURDAY_FIRST_WEEK.slice(todayIndexInWeek),
    ...SATURDAY_FIRST_WEEK.slice(0, todayIndexInWeek),
  ];
  const hasAny = Object.keys(byDay).length > 0;

  return (
    <div>
      <h2>الجدول الأسبوعي</h2>

      {loading && <SkeletonCards count={4} />}

      {!loading && !hasAny && (
        <EmptyState title="مفيش مواعيد مجدولة لأي مجموعة" hint="أضف أيام ووقت للمجموعات من شاشة الصفوف." />
      )}

      {!loading &&
        hasAny &&
        orderedDays.map((day) => {
          const groups = byDay[day] || [];
          if (groups.length === 0) return null;
          return (
            <div key={day} className="card">
              <h3 style={{ marginTop: 0, color: day === today ? 'var(--accent)' : 'var(--text)' }}>
                {WEEKDAY_LABELS[day]} {day === today && '(النهاردة)'}
              </h3>
              {groups.map((g) => (
                <Link
                  key={g.id}
                  href={`/attendance?groupId=${g.id}&date=${todayStr()}`}
                  className="row-between"
                  style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}
                >
                  <div>
                    <strong>{g.grades?.name}</strong> — {g.name}
                  </div>
                  <span className="muted">
                    {g.start_time ? `${formatTime12h(g.start_time)}${g.end_time ? ' - ' + formatTime12h(g.end_time) : ''}` : ''}
                  </span>
                </Link>
              ))}
            </div>
          );
        })}
    </div>
  );
}
