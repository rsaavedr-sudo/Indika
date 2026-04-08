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
  Loader2,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Megaphone,
  Tag,
  Settings,
  User
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

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

interface TransacaoPonto {
  id: string;
  userId: string;
  pontos: number;
  tipo: 'credito' | 'debito';
  origem: 'manual' | 'campanha' | 'bonus' | 'resgate';
  descricao: string;
  createdAt: Timestamp;
  adminEmail?: string;
  saldoAnterior: number;
  saldoNovo: number;
}

interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  pontos: number;
  status: 'ativa' | 'inativa';
  tipo: 'indicacao' | 'acao_manual' | 'bonus' | 'promocional';
  dataInicio: Timestamp;
  dataFim: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'usuarios' | 'campanhas'>('usuarios');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddCampanhaModalOpen, setIsAddCampanhaModalOpen] = useState(false);
  const [isEditCampanhaModalOpen, setIsEditCampanhaModalOpen] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Firestore Listeners
  useEffect(() => {
    if (!profile?.organizationId) return;

    const qUsers = query(
      collection(db, 'usuarios'), 
      where('organizationId', '==', profile.organizationId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Usuario[];
      setUsuarios(docs);
    }, (error) => {
      console.error("Erro ao buscar usuários:", error);
    });

    const qCampanhas = query(
      collection(db, 'campanhas'), 
      where('organizationId', '==', profile.organizationId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeCampanhas = onSnapshot(qCampanhas, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Campanha[];
      setCampanhas(docs);
    }, (error) => {
      console.error("Erro ao buscar campanhas:", error);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeCampanhas();
    };
  }, [profile?.organizationId]);

  const handleLogout = () => signOut(auth);

  const toggleCampanhaStatus = async (campanha: Campanha) => {
    try {
      await updateDoc(doc(db, 'campanhas', campanha.id), {
        status: campanha.status === 'ativa' ? 'inativa' : 'ativa',
        updatedAt: serverTimestamp()
      });
      setToast({ 
        type: 'success', 
        text: `Campanha ${campanha.status === 'ativa' ? 'desativada' : 'ativada'} com sucesso!` 
      });
    } catch (error) {
      console.error("Erro ao atualizar status da campanha:", error);
      setToast({ type: 'error', text: 'Erro ao atualizar status da campanha.' });
    }
  };

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

  const filteredUsers = usuarios.filter(u => 
    `${u.nome} ${u.sobrenome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.cpf.includes(searchTerm)
  );

  const filteredCampanhas = campanhas.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Toast Notification */}
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Indika Admin</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl mr-4">
              <Link 
                to="/admin"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  "bg-white text-indigo-600 shadow-sm"
                )}
              >
                <Settings className="w-4 h-4" />
                Admin
              </Link>
              <Link 
                to="/user"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  "text-slate-500 hover:text-slate-700"
                )}
              >
                <User className="w-4 h-4" />
                Usuário
              </Link>
            </nav>
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl mr-4">
              <button 
                onClick={() => setActiveTab('usuarios')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'usuarios' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Users className="w-4 h-4" />
                Usuários
              </button>
              <button 
                onClick={() => setActiveTab('campanhas')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'campanhas' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Megaphone className="w-4 h-4" />
                Campanhas
              </button>
            </nav>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{profile?.nome} {profile?.sobrenome}</span>
              <span className="text-xs text-slate-500">{profile?.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
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
              placeholder={activeTab === 'usuarios' ? "Buscar por nome, email ou CPF..." : "Buscar campanhas..."}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => activeTab === 'usuarios' ? setIsAddModalOpen(true) : setIsAddCampanhaModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-200"
          >
            {activeTab === 'usuarios' ? <UserPlus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {activeTab === 'usuarios' ? 'Novo Usuário' : 'Nova Campanha'}
          </button>
        </div>

        {activeTab === 'usuarios' ? (
          /* Users Table */
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
                          <Link to={`/admin/usuarios/${usuario.id}`} className="hover:opacity-80 transition-opacity">
                            <div className="font-semibold text-slate-900">{usuario.nome} {usuario.sobrenome}</div>
                            <div className="text-xs text-slate-500">{usuario.email}</div>
                          </Link>
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
                          <Link 
                            to={`/admin/usuarios/${usuario.id}`}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Ver Ficha Completa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
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
        ) : (
          /* Campaigns Table */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campanha</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo / Pontos</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Período</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCampanhas.map((campanha) => (
                    <tr key={campanha.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                            <Megaphone className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{campanha.nome}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{campanha.descricao}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase mb-1">
                          <Tag className="w-3 h-3" />
                          {campanha.tipo}
                        </div>
                        <div className="text-sm font-bold text-indigo-600">{campanha.pontos} pts</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-700 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {campanha.dataInicio?.toDate().toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-xs text-slate-400">até {campanha.dataFim?.toDate().toLocaleDateString('pt-BR')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => toggleCampanhaStatus(campanha)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                            campanha.status === 'ativa' 
                              ? "bg-green-50 text-green-700 hover:bg-green-100" 
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          {campanha.status === 'ativa' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {campanha.status === 'ativa' ? 'Ativa' : 'Inativa'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingCampanha(campanha);
                              setIsEditCampanhaModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar Campanha"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCampanhas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        Nenhuma campanha encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <Modal title="Novo Usuário" onClose={() => setIsAddModalOpen(false)}>
            <AddUserForm 
              onSuccess={() => {
                setIsAddModalOpen(false);
                setToast({ type: 'success', text: 'Usuário criado com sucesso!' });
              }} 
              onError={(err) => setToast({ type: 'error', text: err })}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* Add Campanha Modal */}
      <AnimatePresence>
        {isAddCampanhaModalOpen && (
          <Modal title="Nova Campanha" onClose={() => setIsAddCampanhaModalOpen(false)}>
            <CampanhaForm 
              onSuccess={() => {
                setIsAddCampanhaModalOpen(false);
                setToast({ type: 'success', text: 'Campanha criada com sucesso!' });
              }}
              onError={(err) => setToast({ type: 'error', text: err })}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit Campanha Modal */}
      <AnimatePresence>
        {isEditCampanhaModalOpen && editingCampanha && (
          <Modal title={`Editar Campanha: ${editingCampanha.nome}`} onClose={() => {
            setIsEditCampanhaModalOpen(false);
            setEditingCampanha(null);
          }}>
            <CampanhaForm 
              campanha={editingCampanha}
              onSuccess={() => {
                setIsEditCampanhaModalOpen(false);
                setEditingCampanha(null);
                setToast({ type: 'success', text: 'Campanha atualizada com sucesso!' });
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

function CampanhaForm({ campanha, onSuccess, onError }: { campanha?: Campanha, onSuccess: () => void, onError: (msg: string) => void }) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    nome: campanha?.nome || '',
    descricao: campanha?.descricao || '',
    pontos: campanha?.pontos?.toString() || '',
    status: campanha?.status || 'ativa',
    tipo: campanha?.tipo || 'promocional',
    dataInicio: campanha?.dataInicio ? campanha.dataInicio.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    dataFim: campanha?.dataFim ? campanha.dataFim.toDate().toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    
    if (Number(formData.pontos) <= 0) {
      setError('Os pontos devem ser maiores que 0.');
      return;
    }
    if (new Date(formData.dataFim) < new Date(formData.dataInicio)) {
      setError('A data de fim não pode ser menor que a data de início.');
      return;
    }

    setSubmitting(true);
    setError(null);
    let success = false;

    try {
      const data = {
        ...formData,
        pontos: Number(formData.pontos),
        dataInicio: Timestamp.fromDate(new Date(formData.dataInicio)),
        dataFim: Timestamp.fromDate(new Date(formData.dataFim)),
        updatedAt: serverTimestamp()
      };

      if (campanha) {
        await updateDoc(doc(db, 'campanhas', campanha.id), data);
      } else {
        await addDoc(collection(db, 'campanhas'), {
          ...data,
          organizationId: profile?.organizationId || 'default-org',
          createdAt: serverTimestamp()
        });
        
        setFormData({
          nome: '',
          descricao: '',
          pontos: '',
          status: 'ativa',
          tipo: 'promocional',
          dataInicio: new Date().toISOString().split('T')[0],
          dataFim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
      }
      success = true;
    } catch (err) {
      console.error("Erro ao salvar campanha:", err);
      const msg = 'Erro ao salvar campanha. Tente novamente.';
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

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Nome da Campanha</label>
        <input 
          required
          className={inputClasses}
          value={formData.nome}
          onChange={e => setFormData({...formData, nome: e.target.value})}
          placeholder="Ex: Indicação Premiada"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Descrição</label>
        <textarea 
          required
          rows={2}
          className={cn(inputClasses, "resize-none")}
          value={formData.descricao}
          onChange={e => setFormData({...formData, descricao: e.target.value})}
          placeholder="Descreva o objetivo da campanha..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Pontos</label>
          <input 
            required
            type="number"
            className={inputClasses}
            value={formData.pontos}
            onChange={e => setFormData({...formData, pontos: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Tipo</label>
          <select 
            className={inputClasses}
            value={formData.tipo}
            onChange={e => setFormData({...formData, tipo: e.target.value as any})}
          >
            <option value="indicacao">Indicação</option>
            <option value="acao_manual">Ação Manual</option>
            <option value="bonus">Bônus</option>
            <option value="promocional">Promocional</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Data Início</label>
          <input 
            required
            type="date"
            className={inputClasses}
            value={formData.dataInicio}
            onChange={e => setFormData({...formData, dataInicio: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Data Fim</label>
          <input 
            required
            type="date"
            className={inputClasses}
            value={formData.dataFim}
            onChange={e => setFormData({...formData, dataFim: e.target.value})}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Status Inicial</label>
        <select 
          className={inputClasses}
          value={formData.status}
          onChange={e => setFormData({...formData, status: e.target.value as any})}
        >
          <option value="ativa">Ativa</option>
          <option value="inativa">Inativa</option>
        </select>
      </div>

      <button 
        disabled={submitting}
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (campanha ? 'Salvar Alterações' : 'Criar Campanha')}
      </button>
    </form>
  );
}

function AddUserForm({ onSuccess, onError }: { onSuccess: () => void, onError: (msg: string) => void }) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    cpf: '',
    cep: '',
    idade: '',
    email: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    let success = false;

    try {
      await addDoc(collection(db, 'usuarios'), {
        ...formData,
        idade: Number(formData.idade),
        pontos: 0,
        ativo: true,
        role: 'usuario',
        organizationId: profile?.organizationId || 'default-org',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setFormData({
        nome: '',
        sobrenome: '',
        cpf: '',
        cep: '',
        idade: '',
        email: ''
      });

      success = true;
    } catch (err) {
      console.error("Erro ao salvar usuário:", err);
      const msg = 'Erro ao criar usuário. Tente novamente.';
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
