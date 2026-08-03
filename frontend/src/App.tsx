import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryProvider, ApolloProvider, UIProvider } from './providers';
import { AuthProvider, ProtectedRoute, Permission, useAuth } from './auth';
import {
  LoginPage,
  LandingPage,
  UnauthorizedPage,
  AdminDashboardPage,
  EnquiryFormPage,
  EnquiryDetailPage,
  PropertyListPage,
  PropertyDetailPage,
  QueueDashboardPage,
  GdprToolsPage,
  MetricsDashboardPage,
} from './pages';
import { NotFoundPage } from './pages/NotFoundPage';
import { AppLayout } from './components/layout/AppLayout';

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="text-sm text-surface-500">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Renders the landing page for unauthenticated users,
 * redirects to the appropriate dashboard based on role.
 */
function RootRedirect() {
  const { isAuthenticated, hasPermission } = useAuth();
  if (isAuthenticated) {
    // Admins go to the dashboard (metrics); agents with ENQUIRY_LIST go to enquiries
    if (hasPermission(Permission.ADMIN_DASHBOARD)) {
      return <Navigate to="/dashboard" replace />;
    }
    if (hasPermission(Permission.ENQUIRY_LIST)) {
      return <Navigate to="/enquiries" replace />;
    }
    return <Navigate to="/properties" replace />;
  }
  return <LandingPage />;
}

/**
 * Wraps protected pages with the AppLayout (sidebar + mobile nav).
 */
function ProtectedLayout({ children, permission }: { children: React.ReactNode; permission: Permission }) {
  return (
    <ProtectedRoute permission={permission}>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <QueryProvider>
      <ApolloProvider>
        <UIProvider>
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<RootRedirect />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/unauthorized" element={<UnauthorizedPage />} />

                  {/* Protected routes with AppLayout */}
                  {/* Enquiries list (was "Dashboard") */}
                  <Route
                    path="/enquiries"
                    element={
                      <ProtectedLayout permission={Permission.ENQUIRY_LIST}>
                        <AdminDashboardPage />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/enquiry/new"
                    element={
                      <ProtectedLayout permission={Permission.ENQUIRY_READ}>
                        <EnquiryFormPage />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/enquiry/:id"
                    element={
                      <ProtectedLayout permission={Permission.ENQUIRY_READ}>
                        <EnquiryDetailPage />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/properties"
                    element={
                      <ProtectedLayout permission={Permission.PROPERTY_VIEW}>
                        <PropertyListPage />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/properties/:slug"
                    element={
                      <ProtectedLayout permission={Permission.PROPERTY_VIEW}>
                        <PropertyDetailPage />
                      </ProtectedLayout>
                    }
                  />
                  {/* Dashboard */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedLayout permission={Permission.ADMIN_DASHBOARD}>
                        <MetricsDashboardPage />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/admin/queues"
                    element={
                      <ProtectedLayout permission={Permission.QUEUE_MANAGE}>
                        <QueueDashboardPage />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/admin/gdpr"
                    element={
                      <ProtectedLayout permission={Permission.GDPR_EXPORT}>
                        <GdprToolsPage />
                      </ProtectedLayout>
                    }
                  />

                  {/* 404 catch-all */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </UIProvider>
      </ApolloProvider>
    </QueryProvider>
  );
}

export default App;
