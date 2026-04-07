import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import UserDashboard from './components/App/UserDashboard';
import AdminDashboard from './components/Admin/AdminDashboard';
import { Loader2, LayoutDashboard, User, Settings, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';

// Neutral Home Component
const Home = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <LayoutDashboard className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Indika</h1>
        <p className="text-slate-500 mb-8">Bem-vindo à plataforma de pontos Indika.</p>

        {!user ? (
          <div className="space-y-4">
            <Link 
              to="/login" 
              className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200"
            >
              Entrar
            </Link>
            <Link 
              to="/register" 
              className="block w-full bg-white border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-all"
            >
              Criar Conta
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl mb-6 text-left">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Logado como</p>
              <p className="font-semibold text-slate-900">{profile?.nome} {profile?.sobrenome}</p>
              <p className="text-sm text-slate-500">{profile?.email}</p>
              <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase">
                {profile?.role}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {profile?.role === 'admin' && (
                <Link 
                  to="/admin" 
                  className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200"
                >
                  <Settings className="w-5 h-5" />
                  Painel Admin
                </Link>
              )}
              <Link 
                to="/user" 
                className="flex items-center justify-center gap-2 w-full bg-white border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-all"
              >
                <User className="w-5 h-5" />
                Área do Usuário
              </Link>
              <button 
                onClick={() => signOut(auth)}
                className="flex items-center justify-center gap-2 w-full text-red-500 font-semibold py-3 hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
                Sair
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
    // Redirect to Home if they have the wrong role, instead of cross-redirecting
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { loading } = useAuth();

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
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected User Routes */}
      <Route path="/user" element={
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
