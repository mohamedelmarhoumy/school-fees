'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) {
        if (active) setLoading(false);
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (active) {
        setProfile(data || null);
        setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const isOwner = profile?.role === 'owner';

  return { profile, loading, isOwner };
}
