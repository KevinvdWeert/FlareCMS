import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import { Login } from '../features/auth/Login';
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
const SettingsLayout = lazy(() =>
  import('../features/settings/SettingsLayout').then((module) => ({ default: module.SettingsLayout }))
);
const FooterEditor = lazy(() =>
  import('../features/settings/FooterEditor').then((module) => ({ default: module.FooterEditor }))
);
const HeaderEditor = lazy(() =>
  import('../features/settings/HeaderEditor').then((module) => ({ default: module.HeaderEditor }))
);
const HomepageBuilder = lazy(() =>
  import('../features/settings/HomepageBuilder').then((module) => ({ default: module.HomepageBuilder }))
);
const SiteIdentityEditor = lazy(() =>
  import('../features/settings/SiteIdentityEditor').then((module) => ({ default: module.SiteIdentityEditor }))
);
const SeoEditor = lazy(() =>
  import('../features/settings/SeoEditor').then((module) => ({ default: module.SeoEditor }))
);
const SnippetsEditor = lazy(() =>
  import('../features/settings/SnippetsEditor').then((module) => ({ default: module.SnippetsEditor }))
);
const ContactEditor = lazy(() =>
  import('../features/settings/ContactEditor').then((module) => ({ default: module.ContactEditor }))
);
const MediaCreditEditor = lazy(() =>
  import('../features/settings/MediaCreditEditor').then((module) => ({ default: module.MediaCreditEditor }))
);
const LinkChecker = lazy(() =>
  import('../features/settings/LinkChecker').then((module) => ({ default: module.LinkChecker }))
);

import { PublicHome } from '../features/pages/PublicHome';
import { PublicPage } from '../features/pages/PublicPage';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicHome />} />
            <Route path="/:slug" element={<PublicPage />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<Login />} />
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

                {/* Settings Routes */}
                <Route
                  element={
                    <Suspense fallback={<LoadingSpinner label="Loading settings..." />}>
                      <SettingsLayout />
                    </Suspense>
                  }
                >
                  <Route path="/admin/settings" element={<Navigate to="/admin/settings/footer" replace />} />
                  <Route path="/admin/settings/footer" element={<Suspense fallback={<LoadingSpinner label="Loading..." />}><FooterEditor /></Suspense>} />
                  <Route path="/admin/settings/header" element={<Suspense fallback={<LoadingSpinner label="Loading..." />}><HeaderEditor /></Suspense>} />
                  <Route path="/admin/settings/homepage" element={<Suspense fallback={<LoadingSpinner label="Loading..." />}><HomepageBuilder /></Suspense>} />
                  <Route path="/admin/settings/identity" element={<Suspense fallback={<LoadingSpinner label="Loading..." />}><SiteIdentityEditor /></Suspense>} />
                  <Route path="/admin/settings/seo" element={<Suspense fallback={<LoadingSpinner label="Loading..." />}><SeoEditor /></Suspense>} />
                  <Route path="/admin/settings/snippets" element={<Suspense fallback={<LoadingSpinner label="Loading..." />}><SnippetsEditor /></Suspense>} />
                  <Route path="/admin/settings/contact" element={<Suspense fallback={<LoadingSpinner label="Loading..." />}><ContactEditor /></Suspense>} />
                  <Route path="/admin/settings/media-credits" element={<Suspense fallback={<LoadingSpinner label="Loading..." />}><MediaCreditEditor /></Suspense>} />
                  <Route path="/admin/settings/link-checker" element={<Suspense fallback={<LoadingSpinner label="Loading..." />}><LinkChecker /></Suspense>} />
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
