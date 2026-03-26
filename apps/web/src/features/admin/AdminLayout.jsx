import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { logoutFirebase } from '../../lib/auth';
import {
  LogOut,
  FileText,
  Users,
  ArrowLeft,
  Search,
  Bell,
  Settings,
  LayoutDashboard,
  PenSquare,
  Images
} from 'lucide-react';

export const AdminLayout = () => {
  const { profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutFirebase();
    navigate('/admin/login');
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand-wrap">
          <div className="admin-brand">FlareCMS</div>
          <p className="admin-brand-subtitle">Firebase CMS</p>
        </div>

        <nav className="admin-nav">
          <NavLink to="/admin/dashboard" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/admin/pages" end className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
            <FileText size={18} />
            <span>ContentLibrary</span>
          </NavLink>

          <NavLink to="/admin/pages/new" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
            <PenSquare size={18} />
            <span>ContentEditor</span>
          </NavLink>

          <NavLink to="/admin/media" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
            <Images size={18} />
            <span>MediaManager</span>
          </NavLink>

          {isAdmin && (
            <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}>
              <Users size={18} />
              <span>UserManagement</span>
            </NavLink>
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <a href="/" target="_blank" rel="noopener noreferrer" className="admin-nav-link subtle">
            <ArrowLeft size={18} />
            <span>View Site</span>
          </a>

          <div className="admin-user-pill">
            <div className="admin-user-avatar">{(profile?.fullName || profile?.displayName || user?.email || 'A').charAt(0).toUpperCase()}</div>
            <div>
              <p className="admin-user-name">{profile?.fullName || profile?.displayName || user?.email || 'Administrator'}</p>
              <p className="admin-user-role">{profile?.role || 'user'}</p>
            </div>
          </div>

          <div className="admin-session">
            <button onClick={handleLogout} className="admin-logout-button" type="button">
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <label className="admin-search-wrap" htmlFor="admin-global-search">
            <Search size={16} />
            <input id="admin-global-search" type="search" placeholder="Search pages, assets, metadata..." />
          </label>

          <div className="admin-topbar-actions">
            <button type="button" className="admin-top-icon-btn" aria-label="Notifications">
              <Bell size={17} />
            </button>
            <button type="button" className="admin-top-icon-btn" aria-label="Settings">
              <Settings size={17} />
            </button>
            <div className="admin-topbar-divider" />
          </div>
        </header>

        <section className="admin-canvas">
          <Outlet />
        </section>
      </main>
    </div>
  );
};
