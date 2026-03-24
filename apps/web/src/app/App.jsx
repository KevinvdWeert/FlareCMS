import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import { Login } from '../features/auth/Login';
import { Signup } from '../features/auth/Signup';
import { PasswordReset } from '../features/auth/PasswordReset';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingSpinner } from '../components/LoadingSpinner';

const AdminLayout = lazy(() =>
  import('../features/admin/AdminLayout').then((module) => ({ default: module.AdminLayout }))
);
const Dashboard = lazy(() =>
  import('../features/dashboard/Dashboard').then((module) => ({ default: module.Dashboard }))
);
const MediaManager = lazy(() =>
  import('../features/media/MediaManager').then((module) => ({ default: module.MediaManager }))
);
const PageList = lazy(() =>
  import('../features/pages/PageList').then((module) => ({ default: module.PageList }))
);
const PageEditor = lazy(() =>
  import('../features/pages/PageEditor').then((module) => ({ default: module.PageEditor }))
);
const UserList = lazy(() =>
  import('../features/users/UserList').then((module) => ({ default: module.UserList }))
);

import { PublicHome } from '../features/pages/PublicHome';
import { PublicPage } from '../features/pages/PublicPage';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicHome />} />
            <Route path="/:slug" element={<PublicPage />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/password-reset" element={<PasswordReset />} />

            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <Suspense fallback={<LoadingSpinner label="Loading admin..." />}>
                    <AdminLayout />
                  </Suspense>
                }
              >
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route
                  path="/admin/dashboard"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Loading dashboard..." />}>
                      <Dashboard />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/pages"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Loading pages..." />}>
                      <PageList />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/pages/new"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Loading editor..." />}>
                      <PageEditor />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/pages/:id"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Loading editor..." />}>
                      <PageEditor />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/media"
                  element={
                    <Suspense fallback={<LoadingSpinner label="Loading media..." />}>
                      <MediaManager />
                    </Suspense>
                  }
                />

                <Route element={<ProtectedRoute requireAdmin={true} />}>
                  <Route
                    path="/admin/users"
                    element={
                      <Suspense fallback={<LoadingSpinner label="Loading users..." />}>
                        <UserList />
                      </Suspense>
                    }
                  />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
