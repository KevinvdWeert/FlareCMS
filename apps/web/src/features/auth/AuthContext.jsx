import React, { createContext, useContext, useEffect, useState } from 'react';
import { observeAuthState } from '../../lib/auth';
import { getUserProfile } from '../../lib/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = observeAuthState(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // Fetch user profile from Firestore to get role
          const userDoc = await getUserProfile(firebaseUser.uid);
          setProfile(userDoc || { role: 'user' });
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setProfile({ role: 'user' });
        }
      } else {
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
