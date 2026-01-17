import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { LanguageProvider } from './components/providers/LanguageContext';
import { NotificationProvider } from './components/providers/NotificationContext';
import { SidebarProvider } from './components/providers/SidebarContext';
import { Toaster } from 'sonner';
import UserNotRegisteredError from './components/UserNotRegisteredError';
import ErrorBoundary from './components/ErrorBoundary';
import pagesConfig from './pages.config';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const { Pages, Layout, mainPage } = pagesConfig;

function AppRoutes() {
  const { isAuthenticated, isLoadingAuth, authError } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#42C0B9]"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Please log in</h1>
          <p className="text-slate-600">You need to be authenticated to access this application.</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${mainPage}`} replace />} />
      {Object.entries(Pages).map(([name, Component]) => (
        <Route
          key={name}
          path={`/${name}`}
          element={
            <Layout>
              <Component />
            </Layout>
          }
        />
      ))}
      <Route path="*" element={<Navigate to={`/${mainPage}`} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LanguageProvider>
            <NotificationProvider>
              <SidebarProvider>
                <Router>
                  <AppRoutes />
                  <Toaster position="top-center" richColors />
                </Router>
              </SidebarProvider>
            </NotificationProvider>
          </LanguageProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
