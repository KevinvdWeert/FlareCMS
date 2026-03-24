import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

export const ProtectedRoute = ({ requireAdmin = false }) => {
  const { user, profile, loading, isStaff, isAdmin } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <div>Forbidden: Admins only.</div>;
  }

  if (!isStaff) {
    return <div>Forbidden: Staff only.</div>;
  }

  return <Outlet />;
};
