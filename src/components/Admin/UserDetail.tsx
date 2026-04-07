import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Trophy,
  ArrowLeft, 
  Save, 
  User, 
  Mail, 
  CreditCard, 
  MapPin, 
  Calendar, 
  Shield, 
  Key, 
  History, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  UserPlus,
  Lock,
  Unlock,
  RefreshCw,
  Plus
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface Usuario {
  id: string;
  nome: string;
  sobrenome: string;
  cpf: string;
  cep: string;
  idade: number;
  email: string;
  pontos: number;
  ativo: boolean;
  role: 'admin' | 'usuario';
  uid?: string; // Firebase Auth UID
  emailLogin?: string;
  hasAccess?: boolean;
  accessCreatedAt?: Timestamp;
  mustChangePassword?: boolean;
  createdAt: Timestamp;
}

interface TransacaoPonto {
  id: string;
  pontos: number;
  tipo: 'credito' | 'debito';
  origem: string;
  descricao: string;
  createdAt: Timestamp;
}

interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  pontos: number;
  status: 'ativa' | 'inativa';
  tipo: 'indicacao' | 'acao_manual' | 'bonus' | 'promocional';
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transacoes, setTransacoes] = useState<TransacaoPonto[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  
  // Auth Access State
  const [authLoading, setAuthLoading] = useState(false);
  const [authAccount, setAuthAccount] = useState<{
    exists: boolean;
    email?: string;
    disabled?: boolean;
    lastSignInTime?: string;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Usuario>>({});
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    if (!id) return;

    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'usuarios', id));
        if (userDoc.exists()) {
          const data = { id: userDoc.id, ...userDoc.data() } as Usuario;
          setUsuario(data);
          setFormData(data);
          
          // Check Auth Account via API
          checkAuthAccount(data.email, data.uid);
        } else {
          setToast({ type: 'error', text: 'Usuário não encontrado.' });
          setTimeout(() => navigate('/admin'), 2000);
        }
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
        setToast({ type: 'error', text: 'Erro ao carregar dados do usuário.' });
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Transactions Listener
    const q = query(
      collection(db, 'transacoes_pontos'),
      where('userId', '==', id),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TransacaoPonto[];
      setTransacoes(docs);
    });

    return () => unsubscribe();
  }, [id, navigate]);

  const checkAuthAccount = async (email: string, uid?: string) => {
    setAuthLoading(true);
    try {
      const response = await fetch(`/api/admin/auth/check?email=${encodeURIComponent(email)}&uid=${uid || ''}`);
      const data = await response.json();
      setAuthAccount(data);
      if (data.exists) {
        setAuthForm(prev => ({ ...prev, email: data.email }));
      } else {
        setAuthForm(prev => ({ ...prev, email: email }));
      }
    } catch (error) {
      console.error("Erro ao verificar conta de acesso:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'usuarios', id), {
        ...formData,
        updatedAt: serverTimestamp()
      });
      setToast({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      setToast({ type: 'error', text: 'Erro ao salvar perfil.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAuth = async () => {
    if (!id || !usuario) return;
    
    // Basic validation
    if (!authForm.email || !authForm.email.includes('@')) {
      setToast({ type: 'error', text: 'Por favor, insira um email válido.' });
      return;
    }
    if (!authForm.password || authForm.password.length < 6) {
      setToast({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch('/api/admin/auth/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: id,
          email: authForm.email,
          password: authForm.password,
          nome: usuario.nome,
          sobrenome: usuario.sobrenome
        })
      });
      
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Erro do servidor: ${response.status}`);
      }

      if (response.ok) {
        setToast({ type: 'success', text: 'Acesso criado com sucesso!' });
        
        // Re-fetch user document to get the new fields (hasAccess, emailLogin, etc.)
        const userDoc = await getDoc(doc(db, 'usuarios', id));
        if (userDoc.exists()) {
          const updatedData = { id: userDoc.id, ...userDoc.data() } as Usuario;
          setUsuario(updatedData);
          setFormData(updatedData);
        }

        checkAuthAccount(authForm.email, data.uid);
      } else {
        throw new Error(data.message || 'Erro ao criar acesso.');
      }
    } catch (error: any) {
      console.error("Erro na criação de acesso:", error);
      setToast({ type: 'error', text: error.message || 'Falha na comunicação com o servidor.' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateAuth = async (action: 'email' | 'password' | 'status') => {
    if (!authAccount || !id || !usuario) return;
    
    // Validation for updates
    if (action === 'email' && (!authForm.email || !authForm.email.includes('@'))) {
      setToast({ type: 'error', text: 'Por favor, insira um email válido.' });
      return;
    }
    if (action === 'password' && (!authForm.password || authForm.password.length < 6)) {
      setToast({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch('/api/admin/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: usuario.uid,
          email: authForm.email,
          password: authForm.password,
          disabled: action === 'status' ? !authAccount.disabled : authAccount.disabled,
          action
        })
      });
      
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Erro do servidor: ${response.status}`);
      }

      if (response.ok) {
        setToast({ type: 'success', text: 'Acesso atualizado com sucesso!' });
        checkAuthAccount(authForm.email, usuario.uid);
        // Clear password field after update
        if (action === 'password') setAuthForm(prev => ({ ...prev, password: '' }));
      } else {
        throw new Error(data.message || 'Erro ao atualizar acesso.');
      }
    } catch (error: any) {
      console.error("Erro na atualização de acesso:", error);
      setToast({ type: 'error', text: error.message || 'Falha na comunicação com o servidor.' });
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              "fixed bottom-8 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl font-semibold flex items-center gap-3 min-w-[320px] justify-center",
              toast.type === 'success' ? "bg-indigo-600 text-white" : "bg-red-600 text-white"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin')}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Ficha do Usuário</h1>
              <p className="text-xs text-slate-500 font-medium">ID: {id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
              usuario?.ativo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            )}>
              {usuario?.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Profile Data */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <User className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-slate-900">Dados Cadastrais</h2>
                </div>
              </div>
              
              <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nome</label>
                    <input 
                      type="text"
                      value={formData.nome || ''}
                      onChange={e => setFormData({...formData, nome: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Sobrenome</label>
                    <input 
                      type="text"
                      value={formData.sobrenome || ''}
                      onChange={e => setFormData({...formData, sobrenome: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">CPF</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="text"
                        value={formData.cpf || ''}
                        onChange={e => setFormData({...formData, cpf: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">CEP</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="text"
                        value={formData.cep || ''}
                        onChange={e => setFormData({...formData, cep: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Idade</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="number"
                        value={formData.idade || ''}
                        onChange={e => setFormData({...formData, idade: parseInt(e.target.value)})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Email de Contato</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="email"
                        value={formData.email || ''}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Perfil de Acesso</label>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <select 
                        value={formData.role || 'usuario'}
                        onChange={e => setFormData({...formData, role: e.target.value as 'admin' | 'usuario'})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all appearance-none bg-white"
                      >
                        <option value="usuario">Usuário Comum</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Saldo de Pontos</label>
                    <div className="relative">
                      <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="number"
                        value={formData.pontos || 0}
                        onChange={e => setFormData({...formData, pontos: parseInt(e.target.value)})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Status do Cadastro</label>
                    <div className="flex items-center gap-4 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="radio" 
                          checked={formData.ativo === true}
                          onChange={() => setFormData({...formData, ativo: true})}
                          className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">Ativo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="radio" 
                          checked={formData.ativo === false}
                          onChange={() => setFormData({...formData, ativo: false})}
                          className="w-5 h-5 text-red-600 focus:ring-red-500 border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">Inativo</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </section>

            {/* History Section */}
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                    <History className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-slate-900">Histórico de Transações</h2>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Data</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Origem</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Descrição</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Pontos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transacoes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          Nenhuma transação encontrada.
                        </td>
                      </tr>
                    ) : (
                      transacoes.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {t.createdAt?.toDate().toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              t.tipo === 'credito' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            )}>
                              {t.tipo}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">
                            {t.origem}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                            {t.descricao}
                          </td>
                          <td className={cn(
                            "px-6 py-4 whitespace-nowrap text-right text-sm font-bold",
                            t.tipo === 'credito' ? "text-emerald-600" : "text-red-600"
                          )}>
                            {t.tipo === 'credito' ? '+' : '-'}{t.pontos}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Right Column: Access & Stats */}
          <div className="space-y-8">
            {/* Points Summary Card */}
            <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200">
              <div className="flex items-center justify-between mb-4">
                <p className="text-indigo-100 text-sm font-medium">Saldo Atual</p>
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-4xl font-bold mb-1">{usuario?.pontos || 0}</h3>
                  <p className="text-indigo-100 text-xs">Pontos Indika acumulados</p>
                </div>
                <button 
                  onClick={() => setIsPointsModalOpen(true)}
                  className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-all flex items-center gap-2"
                >
                  <Plus className="w-3 h-3" />
                  Gerenciar
                </button>
              </div>
            </div>

            {/* Platform Access Section */}
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                    <Key className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-slate-900">Acesso à Plataforma</h2>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {authLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-sm font-medium">Verificando conta...</p>
                  </div>
                ) : authAccount?.exists ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <div className="flex items-center gap-3 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <p className="font-bold text-emerald-900 text-sm">Conta Vinculada</p>
                      </div>
                      <p className="text-xs text-emerald-700 mb-1">O usuário já possui acesso à plataforma.</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          authAccount.disabled ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {authAccount.disabled ? 'Acesso Bloqueado' : 'Acesso Liberado'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Email de Login</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="email"
                            value={authForm.email}
                            onChange={e => setAuthForm({...authForm, email: e.target.value})}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <button 
                          onClick={() => handleUpdateAuth('email')}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                        >
                          Atualizar Email
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nova Senha</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="password"
                            placeholder="Deixe em branco para manter"
                            value={authForm.password}
                            onChange={e => setAuthForm({...authForm, password: e.target.value})}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <button 
                          onClick={() => handleUpdateAuth('password')}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                        >
                          Redefinir Senha
                        </button>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <button 
                          onClick={() => handleUpdateAuth('status')}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all",
                            authAccount.disabled 
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100" 
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          )}
                        >
                          {authAccount.disabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          {authAccount.disabled ? 'Ativar Acesso' : 'Desativar Acesso'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        <p className="font-bold text-amber-900 text-sm">Sem Acesso</p>
                      </div>
                      <p className="text-xs text-amber-700">Este usuário ainda não possui uma conta de acesso criada.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Email de Login</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="email"
                            value={authForm.email}
                            onChange={e => setAuthForm({...authForm, email: e.target.value})}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Senha Inicial</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="password"
                            value={authForm.password}
                            onChange={e => setAuthForm({...authForm, password: e.target.value})}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={handleCreateAuth}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-100"
                      >
                        <UserPlus className="w-4 h-4" />
                        Criar Acesso
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Quick Actions */}
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-4">Ações Rápidas</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => checkAuthAccount(usuario?.email || '', usuario?.uid)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all text-sm font-medium text-slate-600"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sincronizar Dados
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Points Management Modal */}
      <AnimatePresence>
        {isPointsModalOpen && usuario && (
          <Modal title={`Gerenciar Pontos: ${usuario.nome}`} onClose={() => setIsPointsModalOpen(false)}>
            <ManagePointsForm 
              usuario={usuario}
              onSuccess={() => {
                setIsPointsModalOpen(false);
                setToast({ type: 'success', text: 'Pontos processados com sucesso!' });
                // Refresh user data
                getDoc(doc(db, 'usuarios', usuario.id)).then(doc => {
                  if (doc.exists()) setUsuario({ id: doc.id, ...doc.data() } as Usuario);
                });
              }}
              onError={(err) => setToast({ type: 'error', text: err })}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ManagePointsForm({ usuario, onSuccess, onError }: { usuario: Usuario, onSuccess: () => void, onError: (msg: string) => void }) {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [formData, setFormData] = useState({
    pontos: '',
    tipo: 'credito' as 'credito' | 'debito',
    origem: 'manual' as 'manual' | 'campanha' | 'bonus' | 'resgate',
    descricao: '',
    campanhaId: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'campanhas'), where('status', '==', 'ativa'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Campanha[];
      setCampanhas(docs);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const pontosNum = Number(formData.pontos);

    if (pontosNum <= 0) {
      setError('A quantidade de pontos deve ser maior que 0.');
      return;
    }
    if (!formData.descricao.trim()) {
      setError('A descrição é obrigatória.');
      return;
    }
    if (formData.tipo === 'debito' && pontosNum > (usuario.pontos || 0)) {
      setError('Saldo insuficiente para realizar este débito.');
      return;
    }
    if (formData.origem === 'campanha' && !formData.campanhaId) {
      setError('Selecione uma campanha.');
      return;
    }

    setSubmitting(true);
    setError(null);
    let success = false;

    try {
      const batch = writeBatch(db);
      const saldoAnterior = usuario.pontos || 0;
      const saldoNovo = formData.tipo === 'credito' ? saldoAnterior + pontosNum : saldoAnterior - pontosNum;

      const selectedCampanha = campanhas.find(c => c.id === formData.campanhaId);

      const userRef = doc(db, 'usuarios', usuario.id);
      batch.update(userRef, {
        pontos: saldoNovo,
        updatedAt: serverTimestamp()
      });

      const transRef = doc(collection(db, 'transacoes_pontos'));
      batch.set(transRef, {
        userId: usuario.id,
        pontos: pontosNum,
        tipo: formData.tipo,
        origem: formData.origem,
        descricao: formData.descricao,
        createdAt: serverTimestamp(),
        adminEmail: auth.currentUser?.email || 'admin@indika.com',
        saldoAnterior,
        saldoNovo,
        ...(formData.origem === 'campanha' && selectedCampanha ? {
          campanhaId: selectedCampanha.id,
          campanhaNome: selectedCampanha.nome
        } : {})
      });

      await batch.commit();
      success = true;
    } catch (err) {
      console.error("Erro ao processar pontos:", err);
      const msg = 'Erro ao processar pontos. Tente novamente.';
      setError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }

    if (success) {
      onSuccess();
    }
  };

  const inputClasses = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl text-sm font-medium text-center bg-red-50 text-red-700 border border-red-100 animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      <div className="bg-indigo-50 p-4 rounded-xl flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-semibold text-indigo-600 uppercase">Saldo Atual</div>
          <div className="text-2xl font-bold text-indigo-900">{usuario.pontos || 0} pts</div>
        </div>
        <Trophy className="w-8 h-8 text-indigo-300" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Quantidade</label>
          <input 
            required
            type="number"
            className={inputClasses}
            value={formData.pontos}
            onChange={e => setFormData({...formData, pontos: e.target.value})}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Tipo</label>
          <select 
            className={inputClasses}
            value={formData.tipo}
            onChange={e => setFormData({...formData, tipo: e.target.value as any})}
          >
            <option value="credito">Crédito (+)</option>
            <option value="debito">Débito (-)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Origem</label>
          <select 
            className={inputClasses}
            value={formData.origem}
            onChange={e => setFormData({...formData, origem: e.target.value as any})}
          >
            <option value="manual">Manual</option>
            <option value="campanha">Campanha</option>
            <option value="bonus">Bônus</option>
            <option value="resgate">Resgate</option>
          </select>
        </div>
        {formData.origem === 'campanha' && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Campanha</label>
            <select 
              className={inputClasses}
              value={formData.campanhaId}
              onChange={e => {
                const camp = campanhas.find(c => c.id === e.target.value);
                setFormData({
                  ...formData, 
                  campanhaId: e.target.value,
                  pontos: camp ? camp.pontos.toString() : formData.pontos,
                  descricao: camp ? `Pontos da campanha: ${camp.nome}` : formData.descricao
                });
              }}
            >
              <option value="">Selecionar...</option>
              {campanhas.map(c => (
                <option key={c.id} value={c.id}>{c.nome} ({c.pontos} pts)</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Descrição</label>
        <textarea 
          required
          rows={3}
          className={cn(inputClasses, "resize-none")}
          value={formData.descricao}
          onChange={e => setFormData({...formData, descricao: e.target.value})}
          placeholder="Motivo da alteração..."
        />
      </div>

      <button 
        disabled={submitting}
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Operação'}
      </button>
    </form>
  );
}
