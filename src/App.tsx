import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import UserDashboard from './components/App/UserDashboard';
import AdminDashboard from './components/Admin/AdminDashboard';
import { Loader2 } from 'lucide-react';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: 'admin' | 'usuario' }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    // Redirect to their appropriate dashboard if they have the wrong role
    return <Navigate to={profile?.role === 'admin' ? "/admin" : "/app"} replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        user ? <Navigate to={profile?.role === 'admin' ? "/admin" : "/app"} replace /> : <Login />
      } />
      <Route path="/register" element={
        user ? <Navigate to="/app" replace /> : <Register />
      } />

      {/* Protected User Routes */}
      <Route path="/app" element={
        <ProtectedRoute requiredRole="usuario">
          <UserDashboard />
        </ProtectedRoute>
      } />

      {/* Protected Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } />

      {/* Root Redirect */}
      <Route path="/" element={
        <Navigate to={user ? (profile?.role === 'admin' ? "/admin" : "/app") : "/login"} replace />
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
