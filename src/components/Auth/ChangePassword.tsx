import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Update Auth Password
      await updatePassword(user, password);

      // 2. Update Firestore flag
      if (profile.id) {
        await updateDoc(doc(db, 'usuarios', profile.id), {
          mustChangePassword: false
        });
      }

      setSuccess(true);
      await refreshProfile();
      
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      console.error("Error changing password:", err);
      setError("Erro ao alterar senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100"
      >
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Alterar Senha</h1>
          <p className="text-slate-500 text-sm mt-2">
            Por segurança, você precisa definir uma nova senha no seu primeiro acesso.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100 text-green-700 rounded-xl flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            Senha alterada com sucesso! Redirecionando...
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
            <input 
              type="password"
              required
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha</label>
            <input 
              type="password"
              required
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={loading || success}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Nova Senha'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
