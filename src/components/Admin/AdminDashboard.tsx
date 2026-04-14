import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  CheckCircle2,
  XCircle,
  Trophy,
  UserPlus,
  Loader2,
  Calendar,
  Megaphone,
  Tag,
  Eye,
  Building2,
  AlertCircle,
  Filter,
  ChevronRight,
  ImageIcon,
  Upload,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
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
} from 'firebase/firestore';
import { db } from '../../firebase';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import AdminLayout, { AdminSection } from './AdminLayout';
import FaixasConfig from './FaixasConfig';
import MissoesAdmin from './MissoesAdmin';
import DashboardAdmin from './DashboardAdmin';
import WithdrawalsAdmin from './WithdrawalsAdmin';
import FinanceSettings from './FinanceSettings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Usuario {
  id: string;
  nome: string;
  sobrenome: string;
  cpf: string;
  cep: string;
  uf?: string;
  cidade?: string;
  bairro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  idade: number;
  email: string;
  pontos: number;
  ativo: boolean;
  createdAt: Timestamp;
}

interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  empresa?: string;
  tipo_campanha?: string;
  tipo?: string;
  pontos_tier1?: number;
  pontos?: number;
  meta_tier1?: string;
  pontos_tier2?: number;
  meta_tier2?: string;
  pontos_tier3?: number;
  meta_tier3?: string;
  limite_por_usuario?: number;
  limite_total?: number;
  atribuicao?: 'todos' | 'especificos' | 'grupos';
  notas_internas?: string;
  imagemUrl?: string;
  status: 'rascunho' | 'ativa' | 'pausada' | 'finalizada' | 'inativa';
  dataInicio: Timestamp;
  dataFim: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  organizationId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  ativa: 'Ativa',
  pausada: 'Pausada',
  finalizada: 'Finalizada',
  inativa: 'Inativa',
};

const STATUS_STYLES: Record<string, string> = {
  rascunho: 'bg-stone-100 text-zinc-500',
  ativa: 'bg-green-50 text-green-700',
  pausada: 'bg-amber-50 text-amber-700',
  finalizada: 'bg-stone-50 text-blue-700',
  inativa: 'bg-stone-100 text-zinc-500',
};

const TIPO_LABELS: Record<string, string> = {
  indicacao: 'Indicação',
  venda_direta: 'Venda Direta',
  ativacao: 'Ativação',
  retencao: 'Retenção',
  acao_manual: 'Ação Manual',
  bonus: 'Bônus',
  promocional: 'Promocional',
};

function effectivePontos(c: Campanha) { return c.pontos_tier1 ?? c.pontos ?? 0; }
function effectiveTipo(c: Campanha)   { return c.tipo_campanha || c.tipo || ''; }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'dashboard' | 'usuarios' | 'campanhas' | 'faixas' | 'missoes' | 'withdrawals' | 'finance') || 'dashboard';

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddCampanhaModalOpen, setIsAddCampanhaModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [ufFilter, setUfFilter] = useState<string>('');
  const [cidadeFilter, setCidadeFilter] = useState<string>('');
  const [statusUserFilter, setStatusUserFilter] = useState<string>('todos');

  const setTab = (tab: 'dashboard' | 'usuarios' | 'campanhas' | 'faixas' | 'missoes' | 'withdrawals' | 'finance') => {
    setSearchParams({ tab });
    setSearchTerm('');
    setUfFilter('');
    setCidadeFilter('');
    setStatusUserFilter('todos');
  };

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (!profile?.organizationId) return;

    const qUsers = query(
      collection(db, 'usuarios'),
      where('organizationId', '==', profile.organizationId),
      orderBy('createdAt', 'desc')
    );
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Usuario[]);
    });

    const qCamps = query(
      collection(db, 'campanhas'),
      where('organizationId', '==', profile.organizationId),
      orderBy('createdAt', 'desc')
    );
    const unsubCamps = onSnapshot(qCamps, (snap) => {
      setCampanhas(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campanha[]);
    });

    return () => { unsubUsers(); unsubCamps(); };
  }, [profile?.organizationId]);

  const toggleUserStatus = async (u: Usuario) => {
    try {
      await updateDoc(doc(db, 'usuarios', u.id), { ativo: !u.ativo, updatedAt: serverTimestamp() });
    } catch (e) { console.error(e); }
  };

  const filteredUsers = usuarios.filter(u => {
    const matchSearch =
      `${u.nome} ${u.sobrenome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.cpf.includes(searchTerm) ||
      (u.cep || '').includes(searchTerm);
    const matchUf     = !ufFilter     || (u.uf || '').toUpperCase() === ufFilter.toUpperCase();
    const matchCidade = !cidadeFilter || (u.cidade || '').toLowerCase().includes(cidadeFilter.toLowerCase());
    const matchStatus = statusUserFilter === 'todos'
      || (statusUserFilter === 'ativo' && u.ativo)
      || (statusUserFilter === 'inativo' && !u.ativo);
    return matchSearch && matchUf && matchCidade && matchStatus;
  });

  // Derived lists for geo filter dropdowns
  const availableUfs: string[] = Array.from(
    new Set(usuarios.map(u => u.uf).filter(Boolean) as string[])
  ).sort();
  const availableCidades: string[] = Array.from(
    new Set(
      usuarios
        .filter(u => !ufFilter || (u.uf || '').toUpperCase() === ufFilter.toUpperCase())
        .map(u => u.cidade)
        .filter(Boolean) as string[]
    )
  ).sort();

  const filteredCampanhas = campanhas.filter(c => {
    const matchSearch =
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.empresa || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
    const matchTipo   = tipoFilter === 'todos'   || effectiveTipo(c) === tipoFilter;
    return matchSearch && matchStatus && matchTipo;
  });

  const availableTipos: string[] = Array.from(
    new Set(campanhas.map(c => effectiveTipo(c)).filter(Boolean) as string[])
  );

  const activeSection = (['dashboard', 'campanhas', 'faixas', 'missoes', 'comprar-pontos', 'withdrawals', 'finance'].includes(activeTab)
    ? activeTab
    : 'usuarios') as AdminSection;

  return (
    <AdminLayout activeSection={activeSection}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              'fixed bottom-8 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl font-semibold flex items-center gap-3 min-w-[320px] justify-center',
              toast.type === 'success' ? 'bg-zinc-900 text-white' : 'bg-red-600 text-white'
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="bg-white border-b border-stone-200 px-8 h-16 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">
            {activeTab === 'dashboard' ? 'Dashboard'
              : activeTab === 'usuarios' ? 'Usuários'
              : activeTab === 'campanhas' ? 'Campanhas'
              : activeTab === 'missoes' ? 'Missões'
              : activeTab === 'withdrawals' ? 'Saques Pix'
              : activeTab === 'finance' ? 'Configurações Financeiras'
              : 'Faixas'}
          </h1>
          <p className="text-xs text-zinc-400">
            {activeTab === 'dashboard'
              ? 'Visão geral do programa'
              : activeTab === 'usuarios'
              ? `${usuarios.length} cadastrados · ${usuarios.filter(u => u.ativo).length} ativos`
              : activeTab === 'campanhas'
              ? `${campanhas.length} campanhas · ${campanhas.filter(c => c.status === 'ativa').length} ativas`
              : activeTab === 'missoes'
              ? 'Gerencie as missões da plataforma'
              : activeTab === 'withdrawals'
              ? 'Aprovar, recusar e marcar saques como pagos'
              : activeTab === 'finance'
              ? 'Taxa de conversão e limites de saque'
              : 'Configure os níveis de pontuação'}
          </p>
        </div>
        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
          {([
            { id: 'dashboard', label: 'Dashboard', icon: <span className="w-4 h-4 inline-flex items-center justify-center text-sm">📊</span> },
            { id: 'usuarios',  label: 'Usuários',  icon: <Users className="w-4 h-4" /> },
            { id: 'campanhas', label: 'Campanhas', icon: <Megaphone className="w-4 h-4" /> },
            { id: 'missoes',   label: 'Missões',   icon: <span className="w-4 h-4 inline-flex items-center justify-center text-sm">🎯</span> },
            { id: 'faixas',    label: 'Faixas',    icon: <span className="w-4 h-4 inline-flex items-center justify-center text-sm">🛡️</span> },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.id ? 'bg-white text-amber-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              )}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-8 py-6 max-w-7xl">

        {/* ── Dashboard tab ── */}
        {activeTab === 'dashboard' && <DashboardAdmin />}

        {/* ── Faixas tab ── */}
        {activeTab === 'faixas' && <FaixasConfig />}

        {/* ── Missões tab ── */}
        {activeTab === 'missoes' && <MissoesAdmin />}

        {/* ── Withdrawals tab ── */}
        {activeTab === 'withdrawals' && <WithdrawalsAdmin />}

        {/* ── Finance settings tab ── */}
        {activeTab === 'finance' && <FinanceSettings />}

        {/* ── Stats (only for usuarios / campanhas) ── */}
        {(activeTab === 'usuarios' || activeTab === 'campanhas') && (<>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {activeTab === 'usuarios' ? (
            <>
              <StatCard icon={<Users className="w-5 h-5 text-amber-600" />} bg="bg-stone-50" label="Total cadastrados" value={usuarios.length} />
              <StatCard icon={<CheckCircle2 className="w-5 h-5 text-green-600" />} bg="bg-green-50" label="Contas ativas" value={usuarios.filter(u => u.ativo).length} />
              <StatCard icon={<Trophy className="w-5 h-5 text-amber-600" />} bg="bg-amber-50" label="Total de pontos" value={usuarios.reduce((s, u) => s + (u.pontos || 0), 0)} />
            </>
          ) : (
            <>
              <StatCard icon={<CheckCircle2 className="w-5 h-5 text-green-600" />} bg="bg-green-50" label="Ativas" value={campanhas.filter(c => c.status === 'ativa').length} />
              <StatCard icon={<Megaphone className="w-5 h-5 text-amber-600" />} bg="bg-amber-50" label="Total campanhas" value={campanhas.length} />
              <StatCard icon={<XCircle className="w-5 h-5 text-zinc-400" />} bg="bg-stone-100" label="Pausadas / Finalizadas" value={campanhas.filter(c => c.status === 'pausada' || c.status === 'finalizada').length} />
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder={activeTab === 'usuarios' ? 'Buscar nome, email ou CPF...' : 'Buscar campanhas...'}
                className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            {/* Geographic filters — usuarios only */}
            {activeTab === 'usuarios' && (
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                {/* Status */}
                <select value={statusUserFilter} onChange={e => setStatusUserFilter(e.target.value)}
                  className="text-xs border border-stone-200 bg-white rounded-lg px-3 py-1.5 focus:outline-none text-zinc-600">
                  <option value="todos">Todos</option>
                  <option value="ativo">Ativos</option>
                  <option value="inativo">Inativos</option>
                </select>
                {/* UF */}
                <select value={ufFilter} onChange={e => { setUfFilter(e.target.value); setCidadeFilter(''); }}
                  className="text-xs border border-stone-200 bg-white rounded-lg px-3 py-1.5 focus:outline-none text-zinc-600">
                  <option value="">Todos UF</option>
                  {availableUfs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
                {/* Cidade — only when UF is selected and there are options */}
                {ufFilter && availableCidades.length > 0 && (
                  <select value={cidadeFilter} onChange={e => setCidadeFilter(e.target.value)}
                    className="text-xs border border-stone-200 bg-white rounded-lg px-3 py-1.5 focus:outline-none text-zinc-600">
                    <option value="">Todas Cidades</option>
                    {availableCidades.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {/* Active filter chip */}
                {(ufFilter || cidadeFilter || statusUserFilter !== 'todos') && (
                  <button
                    onClick={() => { setUfFilter(''); setCidadeFilter(''); setStatusUserFilter('todos'); }}
                    className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    {filteredUsers.length} resultado{filteredUsers.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}
            {activeTab === 'campanhas' && (
              <div className="flex items-center gap-2">
                <Filter className="w-3 h-3 text-zinc-400" />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="text-xs border border-stone-200 bg-white rounded-lg px-3 py-1.5 focus:outline-none text-zinc-600">
                  <option value="todos">Todos Status</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="ativa">Ativa</option>
                  <option value="pausada">Pausada</option>
                  <option value="finalizada">Finalizada</option>
                  <option value="inativa">Inativa</option>
                </select>
                {availableTipos.length > 0 && (
                  <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}
                    className="text-xs border border-stone-200 bg-white rounded-lg px-3 py-1.5 focus:outline-none text-zinc-600">
                    <option value="todos">Todos Tipos</option>
                    {availableTipos.map(t => <option key={t} value={t}>{TIPO_LABELS[t] || t}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => activeTab === 'usuarios' ? setIsAddModalOpen(true) : setIsAddCampanhaModalOpen(true)}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-700 text-white font-medium py-2 px-5 rounded-xl shadow-lg shadow-zinc-200 text-sm transition-all"
          >
            {activeTab === 'usuarios' ? <UserPlus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {activeTab === 'usuarios' ? 'Novo Usuário' : 'Nova Campanha'}
          </button>
        </div>

        {/* Tables */}
        {activeTab === 'usuarios' ? (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/70 border-b border-stone-200">
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Usuário</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">CPF / Localização</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pontos</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-stone-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center text-amber-400 font-bold text-sm">
                            {u.nome[0]}{u.sobrenome[0]}
                          </div>
                          <Link to={`/admin/usuarios/${u.id}`} className="hover:opacity-80 transition-opacity">
                            <div className="font-semibold text-zinc-900 text-sm">{u.nome} {u.sobrenome}</div>
                            <div className="text-xs text-zinc-400">{u.email}</div>
                          </Link>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-zinc-700">{u.cpf}</div>
                        <div className="text-xs text-zinc-400 flex items-center gap-1">
                          {u.cidade && u.uf
                            ? <><span className="font-medium text-zinc-500">{u.uf}</span> · {u.cidade}</>
                            : u.cep || '—'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleUserStatus(u)}
                          className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                            u.ativo ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-stone-100 text-zinc-600 hover:bg-slate-200')}>
                          {u.ativo ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          <span className="font-bold text-zinc-900">{u.pontos || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to={`/admin/usuarios/${u.id}`}
                            className="p-2 text-amber-600 hover:bg-stone-50 rounded-lg transition-colors inline-flex">
                            <Edit2 className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-zinc-400">Nenhum usuário encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-stone-100 flex items-center justify-between">
              <span className="text-xs text-zinc-500">{filteredCampanhas.length} campanha{filteredCampanhas.length !== 1 ? 's' : ''}</span>
              <div className="flex gap-2">
                {(['ativa', 'pausada', 'finalizada'] as const).map(s => {
                  const count = campanhas.filter(c => c.status === s).length;
                  return count > 0 ? (
                    <span key={s} className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', STATUS_STYLES[s])}>
                      {STATUS_LABELS[s]}: {count}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/70 border-b border-stone-200">
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Campanha</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo / Pontos</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Período</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCampanhas.map(c => {
                    const tipo   = effectiveTipo(c);
                    const pontos = effectivePontos(c);
                    return (
                      <tr key={c.id} className="hover:bg-stone-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {c.imagemUrl ? (
                              <img src={c.imagemUrl} alt={c.nome}
                                className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-stone-100" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 flex-shrink-0">
                                <Megaphone className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-900 text-sm">{c.nome}</div>
                              {c.empresa
                                ? <div className="text-xs text-zinc-400 flex items-center gap-1"><Building2 className="w-3 h-3" />{c.empresa}</div>
                                : <div className="text-xs text-zinc-400 truncate max-w-[200px]">{c.descricao}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {tipo && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-zinc-600 text-[10px] font-bold uppercase mb-1">
                              <Tag className="w-3 h-3" />{TIPO_LABELS[tipo] || tipo}
                            </div>
                          )}
                          <div className="text-sm font-bold text-amber-600">
                            {pontos} pts
                            {c.pontos_tier2 ? <span className="text-zinc-400 font-normal"> / {c.pontos_tier2}{c.pontos_tier3 ? ` / ${c.pontos_tier3}` : ''}</span> : ''}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-zinc-700 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-zinc-400" />
                            {c.dataInicio?.toDate?.().toLocaleDateString('pt-BR') || '—'}
                          </div>
                          <div className="text-xs text-zinc-400">até {c.dataFim?.toDate?.().toLocaleDateString('pt-BR') || '—'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                            STATUS_STYLES[c.status] || 'bg-stone-100 text-zinc-500')}>
                            {c.status === 'ativa' ? <CheckCircle2 className="w-3 h-3" /> :
                             c.status === 'pausada' ? <XCircle className="w-3 h-3" /> : null}
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/admin/campanhas/${c.id}`}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-stone-50 rounded-lg border border-stone-200 hover:border-stone-300 transition-colors inline-flex ml-auto">
                            <Eye className="w-3.5 h-3.5" />Detalhes<ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCampanhas.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-zinc-400">Nenhuma campanha encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>)}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAddModalOpen && (
          <Modal title="Novo Usuário" onClose={() => setIsAddModalOpen(false)}>
            <AddUserForm
              onSuccess={() => { setIsAddModalOpen(false); setToast({ type: 'success', text: 'Usuário criado com sucesso!' }); }}
              onError={err => setToast({ type: 'error', text: err })}
            />
          </Modal>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddCampanhaModalOpen && (
          <Modal title="Nova Campanha" onClose={() => setIsAddCampanhaModalOpen(false)} wide>
            <CampanhaCreateForm
              onSuccess={() => { setIsAddCampanhaModalOpen(false); setToast({ type: 'success', text: 'Campanha criada com sucesso!' }); }}
              onError={err => setToast({ type: 'error', text: err })}
            />
          </Modal>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: number }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', bg)}>{icon}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn('relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col',
          wide ? 'max-w-2xl' : 'max-w-lg')}
      >
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-bold text-zinc-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ─── Add User Form ────────────────────────────────────────────────────────────

function AddUserForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({ nome: '', sobrenome: '', cpf: '', cep: '', email: '', idade: '', pontos: '0' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));
  const inp = 'w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError(null);
    try {
      await addDoc(collection(db, 'usuarios'), {
        ...form, idade: Number(form.idade), pontos: Number(form.pontos),
        ativo: true, organizationId: profile?.organizationId || 'default-org',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      onSuccess();
    } catch {
      const msg = 'Erro ao criar usuário.'; setError(msg); onError(msg);
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="flex items-center gap-2 p-3 rounded-xl text-sm bg-red-50 text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-zinc-500 uppercase ml-1">Nome</label><input required className={inp} value={form.nome} onChange={e => s('nome', e.target.value)} /></div>
        <div><label className="text-xs font-semibold text-zinc-500 uppercase ml-1">Sobrenome</label><input required className={inp} value={form.sobrenome} onChange={e => s('sobrenome', e.target.value)} /></div>
      </div>
      <div><label className="text-xs font-semibold text-zinc-500 uppercase ml-1">Email</label><input required type="email" className={inp} value={form.email} onChange={e => s('email', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-zinc-500 uppercase ml-1">CPF</label><input required className={inp} value={form.cpf} onChange={e => s('cpf', e.target.value)} /></div>
        <div><label className="text-xs font-semibold text-zinc-500 uppercase ml-1">CEP</label><input className={inp} value={form.cep} onChange={e => s('cep', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-zinc-500 uppercase ml-1">Idade</label><input type="number" className={inp} value={form.idade} onChange={e => s('idade', e.target.value)} /></div>
        <div><label className="text-xs font-semibold text-zinc-500 uppercase ml-1">Pontos Iniciais</label><input type="number" min="0" className={inp} value={form.pontos} onChange={e => s('pontos', e.target.value)} /></div>
      </div>
      <button type="submit" disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-700 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-zinc-200 disabled:opacity-60 text-sm">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        Criar Usuário
      </button>
    </form>
  );
}

// ─── Image Upload Field ───────────────────────────────────────────────────────
// Uses canvas-based compression → stores base64 data URL directly in Firestore.
// No Firebase Storage required (works on free Spark plan).

function compressToDataUrl(file: File, maxWidth = 1200, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const ratio = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas não disponível')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Falha ao carregar imagem')); };
    img.src = objectUrl;
  });
}

export function ImageUploadField({
  value,
  onChange,
  storagePath: _storagePath,   // kept for API compatibility, unused
  label = 'Imagem da Campanha',
}: {
  value?: string;
  onChange: (url: string) => void;
  storagePath?: string;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);

  // Sync preview when value prop changes (async data load)
  useEffect(() => {
    if (!processing) setPreview(value || null);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Arquivo inválido. Use JPG, PNG ou WebP.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Imagem muito grande. Máximo 8 MB.'); return; }
    setError(null);
    setProcessing(true);
    try {
      const dataUrl = await compressToDataUrl(file);
      // Rough size check: Firestore doc limit is 1 MB; base64 overhead ~33%
      if (dataUrl.length > 900_000) {
        setError('Imagem ainda muito grande após compressão. Use uma imagem menor.');
        setProcessing(false);
        return;
      }
      setPreview(dataUrl);
      onChange(dataUrl);
    } catch (e) {
      setError('Erro ao processar imagem. Tente outra.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <label className="text-xs font-semibold text-zinc-500 uppercase ml-1 block mb-2">{label}</label>
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !processing && fileRef.current?.click()}
        className={cn(
          'relative w-full rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden',
          preview ? 'border-transparent' : 'border-stone-200 hover:border-amber-300 bg-stone-50',
          processing && 'pointer-events-none'
        )}
        style={{ aspectRatio: '16/7' }}
      >
        {preview ? (
          <>
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <span className="text-white text-sm font-semibold flex items-center gap-1">
                <Upload className="w-4 h-4" /> Trocar imagem
              </span>
            </div>
            {!processing && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setPreview(null); onChange(''); }}
                className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-10 gap-2 text-zinc-400">
            <ImageIcon className="w-10 h-10 opacity-40" />
            <p className="text-sm font-medium text-zinc-500">Arraste ou clique para enviar</p>
            <p className="text-xs text-zinc-400">JPG, PNG ou WebP · Recomendado 1200×525 (16:7) · Máx 8 MB</p>
          </div>
        )}
        {processing && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <span className="text-white text-xs">Processando…</span>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ─── Create Campaign Form ─────────────────────────────────────────────────────

function CampanhaCreateForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagemUrl, setImagemUrl] = useState('');
  const [tempId] = useState(() => `temp_${Date.now()}`);
  const [form, setForm] = useState({
    nome: '', descricao: '', empresa: '', tipo_campanha: 'promocional',
    pontos_tier1: '', meta_tier1: '', pontos_tier2: '', meta_tier2: '', pontos_tier3: '', meta_tier3: '',
    limite_por_usuario: '', limite_total: '', atribuicao: 'todos', notas_internas: '',
    status: 'ativa',
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  });

  const s = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-stone-50';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.nome.trim()) { setError('O nome é obrigatório.'); return; }
    if (Number(form.pontos_tier1) <= 0) { setError('Pontos do Tier 1 devem ser maiores que 0.'); return; }
    setSubmitting(true); setError(null);
    try {
      await addDoc(collection(db, 'campanhas'), {
        nome: form.nome.trim(), descricao: form.descricao.trim(), empresa: form.empresa.trim(),
        tipo_campanha: form.tipo_campanha, tipo: form.tipo_campanha,
        pontos_tier1: Number(form.pontos_tier1), pontos: Number(form.pontos_tier1),
        meta_tier1: form.meta_tier1.trim(),
        pontos_tier2: form.pontos_tier2 ? Number(form.pontos_tier2) : null,
        meta_tier2: form.meta_tier2.trim(),
        pontos_tier3: form.pontos_tier3 ? Number(form.pontos_tier3) : null,
        meta_tier3: form.meta_tier3.trim(),
        limite_por_usuario: form.limite_por_usuario ? Number(form.limite_por_usuario) : null,
        limite_total: form.limite_total ? Number(form.limite_total) : null,
        atribuicao: form.atribuicao, notas_internas: form.notas_internas.trim(),
        status: form.status, imagemUrl: imagemUrl || null,
        dataInicio: Timestamp.fromDate(new Date(form.dataInicio)),
        dataFim: Timestamp.fromDate(new Date(form.dataFim)),
        organizationId: profile?.organizationId || 'default-org',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      const msg = 'Erro ao criar campanha.'; setError(msg); onError(msg);
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="flex items-center gap-2 p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-100"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      {/* Image */}
      <ImageUploadField
        value={imagemUrl}
        onChange={setImagemUrl}
        storagePath={`campanhas/${tempId}/banner`}
      />

      {/* Basic */}
      <section>
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Informações Básicas</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-zinc-600 mb-1 block">Nome *</label><input required className={inp} value={form.nome} onChange={e => s('nome', e.target.value)} placeholder="Ex: Indicação Premiada" /></div>
            <div><label className="text-xs font-medium text-zinc-600 mb-1 block">Empresa</label><input className={inp} value={form.empresa} onChange={e => s('empresa', e.target.value)} placeholder="Ex: Empresa XYZ" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Tipo</label>
              <select className={inp} value={form.tipo_campanha} onChange={e => s('tipo_campanha', e.target.value)}>
                <option value="indicacao">Indicação</option><option value="venda_direta">Venda Direta</option>
                <option value="ativacao">Ativação</option><option value="retencao">Retenção</option>
                <option value="acao_manual">Ação Manual</option><option value="bonus">Bônus</option>
                <option value="promocional">Promocional</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Status Inicial</label>
              <select className={inp} value={form.status} onChange={e => s('status', e.target.value)}>
                <option value="rascunho">Rascunho</option><option value="ativa">Ativa</option><option value="pausada">Pausada</option>
              </select>
            </div>
          </div>
          <div><label className="text-xs font-medium text-zinc-600 mb-1 block">Descrição</label>
            <textarea required rows={2} className={cn(inp, 'resize-none')} value={form.descricao} onChange={e => s('descricao', e.target.value)} placeholder="Descreva o objetivo..." /></div>
        </div>
      </section>

      {/* Tiers */}
      <section>
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Recompensas</h4>
        <div className="grid grid-cols-3 gap-3">
          {([1, 2, 3] as const).map(tier => (
            <div key={tier} className="bg-stone-50 rounded-xl p-3 border border-stone-100 space-y-2">
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Tier {tier}{tier === 1 ? ' *' : ''}</div>
              <input type="number" min={tier === 1 ? '1' : '0'} required={tier === 1}
                placeholder={`Pontos${tier === 1 ? ' *' : ''}`}
                className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white"
                value={form[`pontos_tier${tier}` as keyof typeof form]}
                onChange={e => s(`pontos_tier${tier}`, e.target.value)} />
              <input type="text" placeholder="Meta (opcional)"
                className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white"
                value={form[`meta_tier${tier}` as keyof typeof form]}
                onChange={e => s(`meta_tier${tier}`, e.target.value)} />
            </div>
          ))}
        </div>
      </section>

      {/* Dates */}
      <section>
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Período</h4>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-zinc-600 mb-1 block">Início *</label><input required type="date" className={inp} value={form.dataInicio} onChange={e => s('dataInicio', e.target.value)} /></div>
          <div><label className="text-xs font-medium text-zinc-600 mb-1 block">Fim *</label><input required type="date" className={inp} value={form.dataFim} onChange={e => s('dataFim', e.target.value)} /></div>
        </div>
      </section>

      {/* Assignment */}
      <section>
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Atribuição</h4>
        <div className="flex gap-2">
          {(['todos', 'especificos', 'grupos'] as const).map(opt => (
            <button key={opt} type="button" onClick={() => s('atribuicao', opt)}
              className={cn('flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all',
                form.atribuicao === opt ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-stone-200 text-zinc-600 hover:border-amber-300')}>
              {opt === 'todos' ? 'Todos' : opt === 'especificos' ? 'Específicos' : 'Grupos'}
            </button>
          ))}
        </div>
      </section>

      <button type="submit" disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-700 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-zinc-200 disabled:opacity-60 text-sm">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Criar Campanha
      </button>
    </form>
  );
}
