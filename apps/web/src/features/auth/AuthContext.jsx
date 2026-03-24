import React, { createContext, useContext, useEffect, useState } from 'react';
import { observeAuthState } from '../../lib/auth';
import { getUserProfile } from '../../lib/firestore';

const AuthContext = createContext();
const PROFILE_CACHE_PREFIX = 'flarecms-profile:';
// Cache profile locally for 1 hour to reduce repeated Firestore reads.
const PROFILE_CACHE_TTL_MS = 60 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = observeAuthState(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const cacheKey = `${PROFILE_CACHE_PREFIX}${firebaseUser.uid}`;
          const cached = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
          let userDoc = null;
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.cachedAt < PROFILE_CACHE_TTL_MS) {
              userDoc = parsed.profile;
            } else {
              localStorage.removeItem(cacheKey);
            }
          }
          if (!userDoc) {
            userDoc = await getUserProfile(firebaseUser.uid);
            if (typeof window !== 'undefined' && userDoc) {
              localStorage.setItem(cacheKey, JSON.stringify({ profile: userDoc, cachedAt: Date.now() }));
            }
          }
          setProfile(userDoc || { role: 'user' });
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setProfile({ role: 'user' });
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${user?.uid || ''}`);
        }
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isEditor: profile?.role === 'editor',
    isStaff: profile?.role === 'admin' || profile?.role === 'editor'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
