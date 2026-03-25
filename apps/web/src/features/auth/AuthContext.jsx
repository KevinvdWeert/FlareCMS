import React, { useEffect, useState } from 'react';
import { observeAuthState } from '../../lib/auth';
import { getUserProfile, observeUserProfile } from '../../lib/firestore';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [loading, setLoading] = useState(true);
  const shouldUseProfileSnapshot = !(
    import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'true'
  );

  useEffect(() => {
    let unsubscribeProfile = null;
    let authInitTimeout = null;

    // Prevent global app lock if Firebase auth initialization stalls.
    authInitTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubscribeAuth = observeAuthState((firebaseUser) => {
      if (authInitTimeout) {
        clearTimeout(authInitTimeout);
        authInitTimeout = null;
      }

      setUser(firebaseUser);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        setLoading(true);
        setProfileError('');

        // Load profile once quickly, then subscribe for background updates.
        (async () => {
          let claimRole = null;
          try {
            const tokenResult = await firebaseUser.getIdTokenResult(true);
            claimRole = tokenResult?.claims?.role || null;
            if (claimRole === 'admin' || claimRole === 'editor') {
              setProfile((prev) => ({ ...(prev || {}), role: claimRole }));
              setProfileError('');
              setLoading(false);
            }
          } catch (error) {
            console.warn('Unable to resolve role claim from ID token:', error);
          }

          try {
            const userDoc = await Promise.race([
              getUserProfile(firebaseUser.uid),
              new Promise((resolve) => setTimeout(() => resolve(null), 3000))
            ]);
            if (userDoc) {
              setProfile(userDoc);
            } else {
              setProfile((prev) => prev || { role: 'user' });
            }
            setProfileError('');
          } catch (error) {
            console.error('Error fetching user profile:', error);
            if (claimRole === 'admin' || claimRole === 'editor') {
              setProfile((prev) => ({ ...(prev || {}), role: claimRole }));
              setProfileError('');
            } else {
              setProfile((prev) => prev || { role: 'user' });
              setProfileError(error?.message || 'Unable to load user profile from Firestore.');
            }
          } finally {
            setLoading(false);
          }
        })();

        if (shouldUseProfileSnapshot) {
          try {
            unsubscribeProfile = observeUserProfile(
              firebaseUser.uid,
              (userDoc) => {
                setProfile(userDoc || { role: 'user' });
                setProfileError('');
              },
              (error) => {
                console.error('Error observing user profile:', error);
                setProfileError(error?.message || 'Live profile sync failed.');
              }
            );
          } catch (error) {
            console.error('Error subscribing to user profile:', error);
            setProfileError(error?.message || 'Unable to subscribe to profile changes.');
          }
        }
      } else {
        setProfile(null);
        setProfileError('');
        setLoading(false);
      }
    });

    return () => {
      if (authInitTimeout) {
        clearTimeout(authInitTimeout);
      }
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      unsubscribeAuth();
    };
  }, []);

  const value = {
    user,
    profile,
    profileError,
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
