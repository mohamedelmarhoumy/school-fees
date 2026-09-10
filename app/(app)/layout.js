'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const NAV_ITEMS = [
  { href: '/accounts', icon: '💰', label: 'الحسابات' },
  { href: '/attendance', icon: '✅', label: 'الحضور' },
  { href: '/students', icon: '👥', label: 'الطلاب' },
  { href: '/grades', icon: '🏫', label: 'الصفوف' },
  { href: '/dashboard', icon: '📊', label: 'الرئيسية' },
];

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/login');
      } else {
        setChecked(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login');
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  if (!checked) {
    return <div className="center-screen">جارِ التحميل...</div>;
  }

  return (
    <div>
      <div className="topbar row-between">
        <span>سجل المدرسة</span>
        <button
          className="btn btn-outline btn-sm"
          style={{ background: 'transparent', color: 'white', borderColor: 'white' }}
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          }}
        >
          خروج
        </button>
      </div>
      <div className="page">{children}</div>
      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
