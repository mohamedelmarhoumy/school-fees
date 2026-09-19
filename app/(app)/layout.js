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
import ProfileProvider from '../../lib/ProfileProvider';

const ALL_NAV_ITEMS = [
  { href: '/accounts', Icon: IconWallet, label: 'الحسابات', show: (p) => p.isOwner || p.profile?.can_payments },
  { href: '/attendance', Icon: IconCheckClipboard, label: 'الحضور', show: (p) => p.isOwner || p.profile?.can_attendance },
  { href: '/students', Icon: IconUsers, label: 'الطلاب', show: (p) => p.isOwner || p.profile?.can_attendance || p.profile?.can_payments || p.profile?.can_students },
  { href: '/grades', Icon: IconBuilding, label: 'الصفوف', show: (p) => p.isOwner },
  { href: '/dashboard', Icon: IconHome, label: 'الرئيسية', show: () => true },
];

export default function AppLayout({ children }) {
  const router = useRouter();
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

  // الـ ProfileProvider بيجيب بيانات المستخدم مرة واحدة بس وتفضل متاحة لكل
  // الشاشات من غير ما كل شاشة تعمل طلب شبكة منفصل لوحدها عند كل تنقل —
  // ده اللي كان بيسبب ظهور "غير مصرح لك" بشكل خاطف قبل كده.
  return (
    <ProfileProvider>
      <AppShell>{children}</AppShell>
    </ProfileProvider>
  );
}

function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const { count: overdueCount, toastVisible, dismissToast } = useOverdueNotifications();
  const profileState = useProfile();
  const navItems = ALL_NAV_ITEMS.filter((item) => item.show(profileState));
  const [teacherIdentity, setTeacherIdentity] = useState(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('profiles')
      .select('display_name, subject_name')
      .eq('role', 'owner')
      .single()
      .then(({ data }) => {
        if (active) setTeacherIdentity(data || null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <div className="topbar row-between">
        <div className="topbar-brand">
          <img src="/icons/logo-header.png" alt="حصتي" className="topbar-logo" />
          <div>
            <div style={{ fontWeight: 700, lineHeight: 1.15 }}>
              {teacherIdentity?.display_name || 'حصتي'}
            </div>
            {teacherIdentity?.subject_name && (
              <div style={{ fontSize: 11.5, opacity: 0.8, fontWeight: 400 }}>{teacherIdentity.subject_name}</div>
            )}
          </div>
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
