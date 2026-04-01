import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';

export const ProtectedRoute = ({ requireAdmin = false }) => {
  const { user, profile, profileError, loading, isStaff, isAdmin } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div style={{ maxWidth: '760px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
        <h2>Forbidden: Admins only.</h2>
        <p>Your account is signed in, but does not have the required admin role.</p>
      </div>
    );
  }

  if (profileError && !isStaff) {
    return (
      <div style={{ maxWidth: '760px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
        <h2>Cannot verify staff role right now.</h2>
        <p>The app could not read your profile from Firestore.</p>
        <p style={{ color: '#b91c1c' }}>{profileError}</p>
        <p>
          UID: <strong>{user?.uid}</strong>
        </p>
        <p>
          Confirm Firestore API is enabled for your Firebase project and refresh this page.
        </p>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div style={{ maxWidth: '760px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
        <h2>Forbidden: Staff only.</h2>
        <p>Your Firebase Auth account is working, but your Firestore user role is not staff yet.</p>
        <p>
          UID: <strong>{user?.uid}</strong>
        </p>
        <p>
          Have an existing admin run the bootstrap script or set <code>users/{user?.uid}.role</code> to
          <code> editor</code> or <code> admin</code> in Firestore.
        </p>
      </div>
    );
  }

  return <Outlet />;
};
