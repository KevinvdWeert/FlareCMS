import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import { Login } from '../features/auth/Login';
import { ProtectedRoute } from '../components/ProtectedRoute';

import { AdminLayout } from '../features/admin/AdminLayout';
import { PageList } from '../features/pages/PageList';
import { PageEditor } from '../features/pages/PageEditor';

import { PublicHome } from '../features/pages/PublicHome';
import { PublicPage } from '../features/pages/PublicPage';

import { UserList } from '../features/users/UserList';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicHome />} />
          <Route path="/:slug" element={<PublicPage />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<Navigate to="/admin/pages" replace />} />
              <Route path="/admin/pages" element={<PageList />} />
              <Route path="/admin/pages/new" element={<PageEditor />} />
              <Route path="/admin/pages/:id" element={<PageEditor />} />
              
              <Route element={<ProtectedRoute requireAdmin={true} />}>
                <Route path="/admin/users" element={<UserList />} />
              </Route>
            </Route>
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
