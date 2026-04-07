import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  Trophy,
  LogOut,
  UserPlus,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { cn } from './lib/utils';

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
  createdAt: Timestamp;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  const [pointsAmount, setPointsAmount] = useState(0);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listener
  useEffect(() => {
    // Access is now free for development
    const q = query(collection(db, 'usuarios'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Usuario[];
      setUsuarios(docs);
    }, (error) => {
      console.error("Erro ao buscar usuários:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erro no login:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const toggleUserStatus = async (usuario: Usuario) => {
    try {
      await updateDoc(doc(db, 'usuarios', usuario.id), {
        ativo: !usuario.ativo,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const addPoints = async () => {
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'usuarios', editingUser.id), {
        pontos: (editingUser.pontos || 0) + pointsAmount,
        updatedAt: serverTimestamp()
      });
      setIsPointsModalOpen(false);
      setPointsAmount(0);
      setEditingUser(null);
    } catch (error) {
      console.error("Erro ao adicionar pontos:", error);
    }
  };

  const filteredUsers = usuarios.filter(u => 
    `${u.nome} ${u.sobrenome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.cpf.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Access is now free for development
  // if (!user) { ... }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Indika</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{user?.displayName || 'Admin Convidado'}</span>
              <span className="text-xs text-slate-500">{user?.email || 'Acesso Livre'}</span>
            </div>
            {user && (
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Total</span>
            </div>
            <div className="text-2xl font-bold">{usuarios.length}</div>
            <div className="text-sm text-slate-500">Usuários cadastrados</div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Ativos</span>
            </div>
            <div className="text-2xl font-bold">{usuarios.filter(u => u.ativo).length}</div>
            <div className="text-sm text-slate-500">Contas em operação</div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Trophy className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Pontos</span>
            </div>
            <div className="text-2xl font-bold">
              {usuarios.reduce((acc, curr) => acc + (curr.pontos || 0), 0).toLocaleString()}
            </div>
            <div className="text-sm text-slate-500">Total de pontos distribuídos</div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por nome, email ou CPF..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-200"
          >
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">CPF / CEP</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pontos</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                          {usuario.nome[0]}{usuario.sobrenome[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{usuario.nome} {usuario.sobrenome}</div>
                          <div className="text-xs text-slate-500">{usuario.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700">{usuario.cpf}</div>
                      <div className="text-xs text-slate-400">{usuario.cep || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleUserStatus(usuario)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                          usuario.ativo 
                            ? "bg-green-50 text-green-700 hover:bg-green-100" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {usuario.ativo ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {usuario.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span className="font-bold text-slate-900">{usuario.pontos || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingUser(usuario);
                            setIsPointsModalOpen(true);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Gerenciar Pontos"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar Perfil"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <Modal title="Novo Usuário" onClose={() => setIsAddModalOpen(false)}>
            <AddUserForm onSuccess={() => setIsAddModalOpen(false)} />
          </Modal>
        )}
      </AnimatePresence>

      {/* Points Modal */}
      <AnimatePresence>
        {isPointsModalOpen && editingUser && (
          <Modal title={`Adicionar Pontos: ${editingUser.nome}`} onClose={() => setIsPointsModalOpen(false)}>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quantidade de Pontos</label>
                <input 
                  type="number"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-xl font-bold text-center"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(Number(e.target.value))}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[10, 50, 100].map(val => (
                  <button 
                    key={val}
                    onClick={() => setPointsAmount(prev => prev + val)}
                    className="py-2 bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 transition-colors"
                  >
                    +{val}
                  </button>
                ))}
              </div>
              <button 
                onClick={addPoints}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200"
              >
                Confirmar Pontos
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
    </div>
  );
}

function AddUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    cpf: '',
    cep: '',
    idade: '',
    email: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'usuarios'), {
        ...formData,
        idade: Number(formData.idade),
        pontos: 0,
        ativo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Nome</label>
          <input 
            required
            className={inputClasses}
            value={formData.nome}
            onChange={e => setFormData({...formData, nome: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Sobrenome</label>
          <input 
            required
            className={inputClasses}
            value={formData.sobrenome}
            onChange={e => setFormData({...formData, sobrenome: e.target.value})}
          />
        </div>
      </div>
      
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Email</label>
        <input 
          required
          type="email"
          className={inputClasses}
          value={formData.email}
          onChange={e => setFormData({...formData, email: e.target.value})}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">CPF</label>
          <input 
            required
            placeholder="000.000.000-00"
            className={inputClasses}
            value={formData.cpf}
            onChange={e => setFormData({...formData, cpf: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">CEP</label>
          <input 
            placeholder="00000-000"
            className={inputClasses}
            value={formData.cep}
            onChange={e => setFormData({...formData, cep: e.target.value})}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Idade</label>
        <input 
          type="number"
          className={inputClasses}
          value={formData.idade}
          onChange={e => setFormData({...formData, idade: e.target.value})}
        />
      </div>

      <button 
        disabled={submitting}
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar Usuário'}
      </button>
    </form>
  );
}
