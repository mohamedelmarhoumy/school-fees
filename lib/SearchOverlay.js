'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabaseClient';
import { IconSearch, IconClose } from './icons';
import Portal from './Portal';

export default function SearchOverlay({ open, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('students')
        .select('*, grades(name), groups_table(name)')
        .or(`name.ilike.%${query}%,student_number.ilike.%${query}%,parent_phone.ilike.%${query}%`)
        .limit(20);
      setResults(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  if (!open) return null;

  const goTo = (studentId) => {
    router.push(`/students/${studentId}`);
    onClose();
  };

  return (
    <Portal>
      <div className="search-overlay" onClick={onClose}>
        <div className="search-panel" onClick={(e) => e.stopPropagation()}>
          <div className="row">
            <IconSearch size={18} />
            <input
              autoFocus
              placeholder="ابحث بالاسم، رقم الطالب، أو رقم ولي الأمر..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="icon-btn" style={{ color: 'var(--text)', borderColor: 'var(--border)' }} onClick={onClose}>
              <IconClose size={15} />
            </button>
          </div>

          {!query.trim() && (
            <div className="muted" style={{ marginTop: 12 }}>
              بحث واحد يوصلك لملف الطالب كامل: اشتراكاته وحضوره.
            </div>
          )}

          {loading && <div className="muted" style={{ marginTop: 12 }}>جارِ البحث...</div>}

          {!loading && query.trim() && results.length === 0 && (
            <div className="muted" style={{ marginTop: 12 }}>لا توجد نتائج مطابقة.</div>
          )}

          {!loading &&
            results.map((s) => (
              <div
                key={s.id}
                className="row-between search-result-row"
                onClick={() => goTo(s.id)}
              >
                <div>
                  <strong>{s.name}</strong>
                  <div className="muted">{s.grades?.name || '—'} / {s.groups_table?.name || '—'}</div>
                </div>
                <span className="muted">{s.student_number ? `#${s.student_number}` : ''}</span>
              </div>
            ))}
        </div>
      </div>
    </Portal>
  );
}
