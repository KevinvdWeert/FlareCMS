import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { logoutFirebase } from '../../lib/auth';
import { LogOut, FileText, Component, Users, ArrowLeft } from 'lucide-react';

export const AdminLayout = () => {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutFirebase();
    navigate('/admin/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', background: '#1e293b', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: '30px' }}>FlareCMS</h2>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '15px', flexGrow: 1 }}>
          <NavLink to="/admin/pages" style={({isActive}) => ({ color: isActive ? '#38bdf8' : 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' })}>
            <FileText size={18} /> Pages
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/users" style={({isActive}) => ({ color: isActive ? '#38bdf8' : 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' })}>
              <Users size={18} /> Users
            </NavLink>
          )}
          
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <a href="/" target="_blank" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ArrowLeft size={18} /> View Site
            </a>
            <div style={{ borderTop: '1px solid #334155', paddingTop: '15px' }}>
              <span style={{ display: 'block', fontSize: '14px', marginBottom: '10px', color: '#94a3b8' }}>
                Signed in as <b>{profile?.role}</b>
              </span>
              <button 
                onClick={handleLogout} 
                style={{ background: 'transparent', color: '#f87171', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: 0, fontSize: '16px' }}>
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        </nav>
      </aside>
      
      {/* Main Content */}
      <main style={{ flexGrow: 1, padding: '40px', background: '#f8fafc' }}>
        <Outlet />
      </main>
    </div>
  );
};
