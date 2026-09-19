'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import EmptyState from '../../../lib/EmptyState';
import { SkeletonCards } from '../../../lib/Skeleton';

const ACTION_ICONS = {
  attendance: '✅',
  payment: '💰',
  student_added: '➕',
  student_updated: '✏️',
  student_deleted: '🗑️',
};

export default function ActivityLogPage() {
  const { loading: profileLoading, isOwner } = useProfile();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOwner) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setLogs(data || []);
      setLoading(false);
    };
    load();
  }, [isOwner]);

  if (profileLoading) return <div className="muted">جارِ التحميل...</div>;
  if (!isOwner) {
    return <EmptyState title="غير مصرح لك بالدخول هنا" hint="سجل النشاط للمدرس (صاحب الحساب) بس." />;
  }

  return (
    <div>
      <h2>سجل النشاط</h2>
      <div className="muted" style={{ marginBottom: 10 }}>آخر 100 عملية من فريقك (أنت والمساعدين)</div>

      {loading && <SkeletonCards count={5} />}
      {!loading && logs.length === 0 && <EmptyState title="لسه مفيش أي نشاط مسجّل" />}

      {!loading &&
        logs.map((log) => (
          <div key={log.id} className="card row-between">
            <div className="row" style={{ gap: 10 }}>
              <span style={{ fontSize: 18 }}>{ACTION_ICONS[log.action] || '•'}</span>
              <div>
                <div>{log.details}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {log.actor_name} —{' '}
                  {new Date(log.created_at).toLocaleString('ar-EG', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
