'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { IconWallet, IconCheckClipboard, IconUsers, IconBuilding, IconHome, IconLogout } from '../../lib/icons';

const NAV_ITEMS = [
  { href: '/accounts', Icon: IconWallet, label: 'الحسابات' },
  { href: '/attendance', Icon: IconCheckClipboard, label: 'الحضور' },
  { href: '/students', Icon: IconUsers, label: 'الطلاب' },
  { href: '/grades', Icon: IconBuilding, label: 'الصفوف' },
  { href: '/dashboard', Icon: IconHome, label: 'الرئيسية' },
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
        <div className="topbar-brand">
          <img src="/icons/logo-header.png" alt="حصتي" className="topbar-logo" />
          <span>حصتي</span>
        </div>
        <button
          className="btn2 btn2-outline btn2-sm"
          style={{ background: 'transparent', color: 'white', borderColor: 'rgba(255,255,255,0.6)' }}
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          }}
        >
          <IconLogout size={15} /> خروج
        </button>
      </div>
      <div className="page page-fade" key={pathname}>
        {children}
      </div>
      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ href, Icon, label }) => (
          <Link key={href} href={href} className={pathname === href ? 'active' : ''}>
            <span className="nav-icon"><Icon size={22} /></span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
