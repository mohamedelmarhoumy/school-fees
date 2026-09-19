'use client';

import { createContext, useContext } from 'react';

export const ProfileContext = createContext({ profile: null, loading: true, isOwner: false });

export function useProfileContext() {
  return useContext(ProfileContext);
}
