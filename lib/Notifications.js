'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabaseClient';
import { getOverdueCount } from './overdue';
import { IconBell, IconClose } from './icons';

const todayKeyFor = (userId) => `hissati-notif-shown-${userId}-${new Date().toISOString().slice(0, 10)}`;

export function useOverdueNotifications() {
  const [count, setCount] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const run = async () => {
      const n = await getOverdueCount();
      setCount(n);

      // نربط مفتاح "اتعرض النهارده" بحساب المدرس نفسه، عشان لو أكتر من مدرس
      // بيستخدموا نفس الجهاز، كل واحد ياخد تنبيهه هو بس
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id;
      if (!userId) return;

      const key = todayKeyFor(userId);
      const alreadyShownToday = localStorage.getItem(key);
      if (!alreadyShownToday && n > 0) {
        setToastVisible(true);
        localStorage.setItem(key, '1');
      }
    };
    run();
  }, []);

  return { count, toastVisible, dismissToast: () => setToastVisible(false) };
}

export function OverdueBell({ count }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} title="التنبيهات">
        <IconBell size={17} />
        {count > 0 && <span className="notif-dot" />}
      </button>
      {open && (
        <div className="notif-dropdown">
          {count > 0 ? (
            <>
              <div>
                فيه <strong>{count}</strong> طالب عليهم متأخرات الشهر ده.
              </div>
              <button
                className="btn2 btn2-primary btn2-sm"
                style={{ marginTop: 8, width: '100%' }}
                onClick={() => {
                  setOpen(false);
                  router.push('/accounts');
                }}
              >
                افتح شاشة الحسابات
              </button>
            </>
          ) : (
            <div>كل الطلاب دافعين الشهر ده 🎉</div>
          )}
        </div>
      )}
    </div>
  );
}

export function OverdueToast({ visible, count, onDismiss }) {
  const router = useRouter();
  if (!visible || count <= 0) return null;

  return (
    <div className="daily-toast">
      <span>
        فيه <strong>{count}</strong> طالب عليهم متأخرات الشهر ده.
      </span>
      <div className="row" style={{ gap: 6 }}>
        <button
          className="btn2 btn2-outline btn2-sm"
          onClick={() => {
            onDismiss();
            router.push('/accounts');
          }}
        >
          عرض
        </button>
        <button className="icon-btn" style={{ color: 'var(--text)', borderColor: 'var(--border)' }} onClick={onDismiss}>
          <IconClose size={14} />
        </button>
      </div>
    </div>
  );
}
