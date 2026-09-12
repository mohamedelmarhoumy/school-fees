'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { IconWallet, IconCheckClipboard, IconUsers, IconBuilding, IconHome, IconLogout, IconSearch } from '../../lib/icons';
import ThemeToggle from '../../lib/ThemeToggle';
import SearchOverlay from '../../lib/SearchOverlay';
import { useOverdueNotifications, OverdueBell, OverdueToast } from '../../lib/Notifications';

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
  const [searchOpen, setSearchOpen] = useState(false);
  const { count: overdueCount, toastVisible, dismissToast } = useOverdueNotifications();

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
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={() => setSearchOpen(true)} title="بحث">
            <IconSearch size={17} />
          </button>
          <OverdueBell count={overdueCount} />
          <ThemeToggle />
          <button
            className="icon-btn"
            title="خروج"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace('/login');
            }}
          >
            <IconLogout size={16} />
          </button>
        </div>
      </div>

      <OverdueToast visible={toastVisible} count={overdueCount} onDismiss={dismissToast} />

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="page page-fade" key={pathname}>
        {children}
      </div>
      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ href, Icon, label }) => (
          <Link key={href} href={href} className={pathname === href ? 'active' : ''}>
            <span className="nav-icon-circle"><Icon size={20} /></span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
