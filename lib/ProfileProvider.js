'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { ProfileContext } from './ProfileContext';

export default function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      // getSession() بيقرأ من التخزين المحلي مباشرة (سريع وموثوق)، بعكس
      // getUser() اللي بيعمل طلب شبكة للتحقق ويسبب سباق توقيت (race) بيظهر
      // فيه "غير مصرح" لحظياً حتى للمستخدم المصرح له فعلاً.
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        if (active) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (active) {
        setProfile(profileData || null);
        setLoading(false);
      }
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => load());

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const isOwner = profile?.role === 'owner';

  return (
    <ProfileContext.Provider value={{ profile, loading, isOwner }}>
      {children}
    </ProfileContext.Provider>
  );
}
