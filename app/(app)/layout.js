'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { IconWallet, IconCheckClipboard, IconUsers, IconBuilding, IconHome, IconLogout, IconSearch, IconUserCircle } from '../../lib/icons';
import ThemeToggle from '../../lib/ThemeToggle';
import SearchOverlay from '../../lib/SearchOverlay';
import { useOverdueNotifications, OverdueBell, OverdueToast } from '../../lib/Notifications';
import { useProfile } from '../../lib/useProfile';

const ALL_NAV_ITEMS = [
  { href: '/accounts', Icon: IconWallet, label: 'الحسابات', show: (p) => p.isOwner || p.profile?.can_payments },
  { href: '/attendance', Icon: IconCheckClipboard, label: 'الحضور', show: (p) => p.isOwner || p.profile?.can_attendance },
  { href: '/students', Icon: IconUsers, label: 'الطلاب', show: (p) => p.isOwner || p.profile?.can_attendance || p.profile?.can_payments || p.profile?.can_students },
  { href: '/grades', Icon: IconBuilding, label: 'الصفوف', show: (p) => p.isOwner },
  { href: '/dashboard', Icon: IconHome, label: 'الرئيسية', show: () => true },
];

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { count: overdueCount, toastVisible, dismissToast } = useOverdueNotifications();
  const profileState = useProfile();
  const navItems = ALL_NAV_ITEMS.filter((item) => item.show(profileState));

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
          <Link href="/account" className="icon-btn" title="إعدادات الحساب">
            <IconUserCircle size={16} />
          </Link>
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
        {navItems.map(({ href, Icon, label }) => (
          <Link key={href} href={href} className={pathname === href ? 'active' : ''}>
            <span className="nav-icon-circle"><Icon size={20} /></span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
