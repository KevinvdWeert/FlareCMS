import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { logoutFirebase } from '../../lib/auth';
import { LogOut, FileText, Users, ArrowLeft } from 'lucide-react';

export const AdminLayout = () => {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutFirebase();
    navigate('/admin/login');
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">FlareCMS</div>

        <nav className="admin-nav">
          <NavLink to="/admin/pages" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
            <FileText size={18} />
            <span>Pages</span>
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
              <Users size={18} />
              <span>Users</span>
            </NavLink>
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <a href="/" target="_blank" className="admin-nav-link subtle">
            <ArrowLeft size={18} />
            <span>View Site</span>
          </a>

          <div className="admin-session">
            <span>
              Signed in as <b>{profile?.role || 'user'}</b>
            </span>
            <button onClick={handleLogout} className="admin-logout-button" type="button">
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};
