'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { WEEKDAY_LABELS, ARABIC_MONTHS } from '../../../lib/constants';
import { SkeletonCards } from '../../../lib/Skeleton';
import EmptyState from '../../../lib/EmptyState';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function DashboardPage() {
  const [todaysGroups, setTodaysGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: groups } = await supabase.from('groups_table').select('*, grades(name)');
      const todayWeekday = new Date().getDay();
      const todays = (groups || [])
        .filter((g) => (g.days_of_week || []).includes(todayWeekday))
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      setTodaysGroups(todays);
      setLoading(false);
    };
    load();
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

      <div className="card">
        <h3 style={{ marginTop: 0 }}>مجموعات اليوم</h3>

        {loading && <SkeletonCards count={3} />}

        {!loading && todaysGroups.length === 0 && (
          <EmptyState title="لا توجد مجموعات مجدولة اليوم" hint="أضف مواعيد للمجموعات من شاشة الصفوف." />
        )}

        {!loading &&
          todaysGroups.map((g) => (
            <Link
              key={g.id}
              href={`/attendance?groupId=${g.id}&date=${todayStr()}`}
              className="row-between"
              style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <strong>{g.grades?.name}</strong> — {g.name}
              </div>
              <span className="muted">
                {g.start_time ? `${g.start_time.slice(0, 5)} - ${g.end_time?.slice(0, 5) || ''}` : ''}
              </span>
            </Link>
          ))}
      </div>
    </div>
  );
}
