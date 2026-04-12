import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Edit2,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  Megaphone,
  Calendar,
  Trophy,
  Tag,
  FileText,
  AlertCircle,
  UserPlus,
  UserMinus,
  ChevronDown,
  Building2,
  BarChart3,
  Clock,
  Info,
  Settings2,
  Lock,
  ImageIcon,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import AdminLayout from './AdminLayout';
import { ImageUploadField } from './AdminDashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampanhaEnhanced {
  id: string;
  nome: string;
  descricao: string;
  empresa?: string;
  tipo_campanha?: 'indicacao' | 'venda_direta' | 'ativacao' | 'retencao';
  tipo?: string; // legacy
  // Tiers
  pontos_tier1: number;
  meta_tier1?: string;
  pontos_tier2?: number;
  meta_tier2?: string;
  pontos_tier3?: number;
  meta_tier3?: string;
  // For backward compat
  pontos?: number;
  // Limits
  limite_por_usuario?: number;
  limite_total?: number;
  // Assignment
  atribuicao?: 'todos' | 'especificos' | 'grupos';
  // Visibility
  notas_internas?: string;
  imagemUrl?: string;
  // Status
  status: 'rascunho' | 'ativa' | 'pausada' | 'finalizada' | 'inativa';
  dataInicio: Timestamp;
  dataFim: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  organizationId: string;
}

interface Usuario {
  id: string;
  nome: string;
  sobrenome: string;
  email: string;
  cpf: string;
  ativo: boolean;
}

interface CampaignParticipation {
  id: string;
  campanhaId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  status: 'registrado' | 'contactado' | 'venda_realizada' | 'rechazado';
  notas?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: string;
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
  rascunho: 'bg-slate-100 text-slate-600',
  ativa: 'bg-green-50 text-green-700',
  pausada: 'bg-amber-50 text-amber-700',
  finalizada: 'bg-blue-50 text-blue-700',
  inativa: 'bg-slate-100 text-slate-500',
};

const PARTICIPATION_LABELS: Record<string, string> = {
  registrado: 'Registrado',
  contactado: 'Contactado',
  venda_realizada: 'Venda Realizada',
  rechazado: 'Recusado',
};

const PARTICIPATION_STYLES: Record<string, string> = {
  registrado: 'bg-blue-50 text-blue-700',
  contactado: 'bg-amber-50 text-amber-700',
  venda_realizada: 'bg-green-50 text-green-700',
  rechazado: 'bg-red-50 text-red-700',
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

function formatDate(ts: Timestamp | undefined) {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleDateString('pt-BR');
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [campanha, setCampanha] = useState<CampanhaEnhanced | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [participations, setParticipations] = useState<CampaignParticipation[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'usuarios' | 'participacoes'>('info');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [participationFilter, setParticipationFilter] = useState<string>('todos');
  const [searchUser, setSearchUser] = useState('');

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Fetch campaign
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'campanhas', id), (snap) => {
      if (snap.exists()) {
        setCampanha({ id: snap.id, ...snap.data() } as CampanhaEnhanced);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // Fetch all org users
  useEffect(() => {
    if (!profile?.organizationId) return;
    const q = query(
      collection(db, 'usuarios'),
      where('organizationId', '==', profile.organizationId),
      orderBy('nome', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Usuario[]);
    });
    return () => unsub();
  }, [profile?.organizationId]);

  // Fetch assignments
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'campaign_user_assignments'), where('campanhaId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set(snap.docs.map((d) => d.data().userId as string));
      setAssignedUserIds(ids);
    });
    return () => unsub();
  }, [id]);

  // Fetch participations
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'campaign_participations'),
      where('campanhaId', '==', id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setParticipations(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CampaignParticipation[]);
    });
    return () => unsub();
  }, [id]);

  // ── Actions ──

  const handleStatusChange = async (newStatus: CampanhaEnhanced['status']) => {
    if (!campanha) return;
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'campanhas', campanha.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setToast({ type: 'success', text: `Status alterado para "${STATUS_LABELS[newStatus]}"` });
    } catch {
      setToast({ type: 'error', text: 'Erro ao alterar status.' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleToggleUser = async (userId: string) => {
    if (!id || !profile) return;
    try {
      if (assignedUserIds.has(userId)) {
        // Remove assignment
        const q = query(
          collection(db, 'campaign_user_assignments'),
          where('campanhaId', '==', id),
          where('userId', '==', userId)
        );
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        setToast({ type: 'success', text: 'Usuário removido da campanha.' });
      } else {
        // Add assignment
        await addDoc(collection(db, 'campaign_user_assignments'), {
          campanhaId: id,
          userId,
          organizationId: profile.organizationId,
          assignedAt: serverTimestamp(),
          assignedBy: profile.email || profile.nome,
        });
        setToast({ type: 'success', text: 'Usuário adicionado à campanha.' });
      }
    } catch {
      setToast({ type: 'error', text: 'Erro ao atualizar atribuição.' });
    }
  };

  const handleAssignAll = async () => {
    if (!id || !profile) return;
    const unassigned = usuarios.filter((u) => !assignedUserIds.has(u.id));
    if (unassigned.length === 0) {
      setToast({ type: 'error', text: 'Todos os usuários já estão atribuídos.' });
      return;
    }
    try {
      const batch = writeBatch(db);
      unassigned.forEach((u) => {
        const ref = doc(collection(db, 'campaign_user_assignments'));
        batch.set(ref, {
          campanhaId: id,
          userId: u.id,
          organizationId: profile.organizationId,
          assignedAt: serverTimestamp(),
          assignedBy: profile.email || profile.nome,
        });
      });
      await batch.commit();
      setToast({ type: 'success', text: `${unassigned.length} usuários adicionados à campanha.` });
    } catch {
      setToast({ type: 'error', text: 'Erro ao atribuir usuários.' });
    }
  };

  const handleUpdateParticipation = async (
    participationId: string,
    newStatus: CampaignParticipation['status'],
    notas?: string
  ) => {
    try {
      await updateDoc(doc(db, 'campaign_participations', participationId), {
        status: newStatus,
        notas: notas || '',
        updatedAt: serverTimestamp(),
        updatedBy: profile?.email || profile?.nome,
      });
      setToast({ type: 'success', text: 'Participação atualizada.' });
    } catch {
      setToast({ type: 'error', text: 'Erro ao atualizar participação.' });
    }
  };

  const handleCreateParticipation = async (userId: string) => {
    if (!id || !profile) return;
    const exists = participations.find((p) => p.userId === userId);
    if (exists) {
      setToast({ type: 'error', text: 'Usuário já possui uma participação nesta campanha.' });
      return;
    }
    const usuario = usuarios.find((u) => u.id === userId);
    try {
      await addDoc(collection(db, 'campaign_participations'), {
        campanhaId: id,
        userId,
        userName: usuario ? `${usuario.nome} ${usuario.sobrenome}` : '',
        userEmail: usuario?.email || '',
        organizationId: profile.organizationId,
        status: 'registrado',
        notas: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: profile.email || profile.nome,
      });
      setToast({ type: 'success', text: 'Participação registrada.' });
    } catch {
      setToast({ type: 'error', text: 'Erro ao registrar participação.' });
    }
  };

  // ── Derived ──

  const filteredParticipations =
    participationFilter === 'todos'
      ? participations
      : participations.filter((p) => p.status === participationFilter);

  const filteredUsuarios = usuarios.filter((u) => {
    const term = searchUser.toLowerCase();
    return (
      `${u.nome} ${u.sobrenome}`.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

  const participationStats = {
    total: participations.length,
    registrado: participations.filter((p) => p.status === 'registrado').length,
    contactado: participations.filter((p) => p.status === 'contactado').length,
    venda_realizada: participations.filter((p) => p.status === 'venda_realizada').length,
    rechazado: participations.filter((p) => p.status === 'rechazado').length,
  };

  const effectivePontos = campanha?.pontos_tier1 ?? campanha?.pontos ?? 0;

  // ── Render ──

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!campanha) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Campanha não encontrada.</p>
          <button
            onClick={() => navigate('/admin')}
            className="mt-4 text-indigo-600 hover:underline text-sm"
          >
            Voltar ao painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout activeSection="campanhas">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              'fixed bottom-8 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl font-semibold flex items-center gap-3 min-w-[320px] justify-center',
              toast.type === 'success' ? 'bg-indigo-600 text-white' : 'bg-red-600 text-white'
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin?tab=campanhas"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">{campanha.nome}</h1>
            {campanha.empresa && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Building2 className="w-3 h-3" />{campanha.empresa}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusDropdown current={campanha.status} onChange={handleStatusChange} loading={updatingStatus} />
          <button onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200">
            <Edit2 className="w-4 h-4" />Editar
          </button>
        </div>
      </div>

      <main className="px-8 py-6 max-w-7xl">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Users className="w-5 h-5 text-indigo-600" />}
            bg="bg-indigo-50"
            label="Usuários Atribuídos"
            value={assignedUserIds.size}
          />
          <StatCard
            icon={<Trophy className="w-5 h-5 text-amber-600" />}
            bg="bg-amber-50"
            label="Pontos (Tier 1)"
            value={effectivePontos}
          />
          <StatCard
            icon={<BarChart3 className="w-5 h-5 text-green-600" />}
            bg="bg-green-50"
            label="Participações"
            value={participationStats.total}
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            bg="bg-emerald-50"
            label="Vendas Realizadas"
            value={participationStats.venda_realizada}
          />
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl mb-6 w-fit">
          {(['info', 'usuarios', 'participacoes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize',
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {tab === 'info' && <Info className="w-4 h-4" />}
              {tab === 'usuarios' && <Users className="w-4 h-4" />}
              {tab === 'participacoes' && <BarChart3 className="w-4 h-4" />}
              {tab === 'info' ? 'Informações' : tab === 'usuarios' ? 'Usuários' : 'Participações'}
              {tab === 'usuarios' && (
                <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {activeTab === 'usuarios' ? assignedUserIds.size : assignedUserIds.size}
                </span>
              )}
              {tab === 'participacoes' && participationStats.total > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-bold',
                  activeTab === 'participacoes' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
                )}>
                  {participationStats.total}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Info */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Main details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Campaign image */}
              {campanha.imagemUrl ? (
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <img
                    src={campanha.imagemUrl}
                    alt={campanha.nome}
                    className="w-full object-cover"
                    style={{ maxHeight: 280 }}
                  />
                </div>
              ) : (
                <div
                  className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400 cursor-pointer hover:border-indigo-300 transition-colors"
                  style={{ height: 140 }}
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <ImageIcon className="w-8 h-8 opacity-30" />
                  <p className="text-sm">Clique em Editar para adicionar imagem da campanha</p>
                </div>
              )}
              <InfoCard title="Descrição" icon={<FileText className="w-4 h-4" />}>
                <p className="text-slate-700 whitespace-pre-line">{campanha.descricao || 'Sem descrição.'}</p>
              </InfoCard>

              <InfoCard title="Recompensas" icon={<Trophy className="w-4 h-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <TierCard
                    tier="Tier 1"
                    pontos={campanha.pontos_tier1 ?? campanha.pontos ?? 0}
                    meta={campanha.meta_tier1}
                    active
                  />
                  {campanha.pontos_tier2 !== undefined && campanha.pontos_tier2 > 0 && (
                    <TierCard tier="Tier 2" pontos={campanha.pontos_tier2} meta={campanha.meta_tier2} />
                  )}
                  {campanha.pontos_tier3 !== undefined && campanha.pontos_tier3 > 0 && (
                    <TierCard tier="Tier 3" pontos={campanha.pontos_tier3} meta={campanha.meta_tier3} />
                  )}
                </div>
              </InfoCard>

              {campanha.notas_internas && (
                <InfoCard
                  title="Notas Internas"
                  icon={<Lock className="w-4 h-4" />}
                  className="border-amber-200 bg-amber-50/30"
                >
                  <p className="text-slate-700 whitespace-pre-line text-sm">{campanha.notas_internas}</p>
                </InfoCard>
              )}
            </div>

            {/* Right: Metadata */}
            <div className="space-y-4">
              <InfoCard title="Detalhes" icon={<Settings2 className="w-4 h-4" />}>
                <dl className="space-y-3 text-sm">
                  <DetailRow label="Status">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', STATUS_STYLES[campanha.status] || 'bg-slate-100 text-slate-600')}>
                      {STATUS_LABELS[campanha.status] || campanha.status}
                    </span>
                  </DetailRow>
                  <DetailRow label="Tipo">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-bold uppercase">
                      <Tag className="w-3 h-3" />
                      {TIPO_LABELS[campanha.tipo_campanha || campanha.tipo || ''] || campanha.tipo_campanha || campanha.tipo || '—'}
                    </span>
                  </DetailRow>
                  {campanha.empresa && (
                    <DetailRow label="Empresa">
                      <span className="flex items-center gap-1 text-slate-700">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {campanha.empresa}
                      </span>
                    </DetailRow>
                  )}
                  <DetailRow label="Atribuição">
                    <span className="text-slate-700 capitalize">
                      {campanha.atribuicao === 'todos'
                        ? 'Todos os usuários'
                        : campanha.atribuicao === 'especificos'
                        ? 'Usuários específicos'
                        : campanha.atribuicao === 'grupos'
                        ? 'Por grupos'
                        : '—'}
                    </span>
                  </DetailRow>
                  {campanha.limite_por_usuario && (
                    <DetailRow label="Limite/Usuário">
                      <span className="text-slate-700">{campanha.limite_por_usuario}x</span>
                    </DetailRow>
                  )}
                  {campanha.limite_total && (
                    <DetailRow label="Limite Total">
                      <span className="text-slate-700">{campanha.limite_total.toLocaleString()}</span>
                    </DetailRow>
                  )}
                </dl>
              </InfoCard>

              <InfoCard title="Período" icon={<Calendar className="w-4 h-4" />}>
                <dl className="space-y-3 text-sm">
                  <DetailRow label="Início">
                    <span className="flex items-center gap-1 text-slate-700">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDate(campanha.dataInicio)}
                    </span>
                  </DetailRow>
                  <DetailRow label="Fim">
                    <span className="flex items-center gap-1 text-slate-700">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDate(campanha.dataFim)}
                    </span>
                  </DetailRow>
                  <DetailRow label="Criada em">
                    <span className="text-slate-500 text-xs">{formatDate(campanha.createdAt)}</span>
                  </DetailRow>
                  <DetailRow label="Atualizada em">
                    <span className="text-slate-500 text-xs">{formatDate(campanha.updatedAt)}</span>
                  </DetailRow>
                </dl>
              </InfoCard>
            </div>
          </div>
        )}

        {/* Tab: Usuários */}
        {activeTab === 'usuarios' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar usuário..."
                  className="w-64 pl-3 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">
                  {assignedUserIds.size} de {usuarios.length} atribuídos
                </span>
                <button
                  onClick={handleAssignAll}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Atribuir Todos
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Participação</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Atribuição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsuarios.map((u) => {
                    const isAssigned = assignedUserIds.has(u.id);
                    const participation = participations.find((p) => p.userId === u.id);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                              {u.nome[0]}{u.sobrenome[0]}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">{u.nome} {u.sobrenome}</div>
                              <div className="text-xs text-slate-400">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                            u.ativo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                          )}>
                            {u.ativo ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {participation ? (
                            <div className="flex items-center gap-2">
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PARTICIPATION_STYLES[participation.status])}>
                                {PARTICIPATION_LABELS[participation.status]}
                              </span>
                            </div>
                          ) : isAssigned ? (
                            <button
                              onClick={() => handleCreateParticipation(u.id)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                            >
                              + Registrar
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleToggleUser(u.id)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                              isAssigned
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            )}
                          >
                            {isAssigned ? (
                              <>
                                <UserMinus className="w-3 h-3" />
                                Remover
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-3 h-3" />
                                Atribuir
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsuarios.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Participações */}
        {activeTab === 'participacoes' && (
          <div>
            {/* Stats chips */}
            <div className="flex flex-wrap gap-3 mb-6">
              {(['todos', 'registrado', 'contactado', 'venda_realizada', 'rechazado'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setParticipationFilter(s)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
                    participationFilter === s
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
                  )}
                >
                  {s === 'todos' ? `Todos (${participationStats.total})` : `${PARTICIPATION_LABELS[s]} (${participationStats[s as keyof typeof participationStats]})`}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Notas</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Atualizar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParticipations.map((p) => (
                      <ParticipationRow
                        key={p.id}
                        participation={p}
                        usuarios={usuarios}
                        onUpdate={handleUpdateParticipation}
                      />
                    ))}
                    {filteredParticipations.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          Nenhuma participação registrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <CampanhaEditModal
            campanha={campanha}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={(msg) => {
              setIsEditModalOpen(false);
              setToast({ type: 'success', text: msg });
            }}
            onError={(msg) => setToast({ type: 'error', text: msg })}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: number }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', bg)}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function InfoCard({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-white rounded-2xl border border-slate-200 shadow-sm p-6', className)}>
      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
        <span className="text-slate-400">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400 text-xs">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function TierCard({ tier, pontos, meta, active }: { tier: string; pontos: number; meta?: string; active?: boolean }) {
  return (
    <div className={cn(
      'p-4 rounded-xl border text-center',
      active ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'
    )}>
      <div className={cn('text-xs font-bold uppercase mb-1', active ? 'text-indigo-500' : 'text-slate-400')}>{tier}</div>
      <div className={cn('text-2xl font-black', active ? 'text-indigo-700' : 'text-slate-700')}>{pontos}</div>
      <div className={cn('text-xs mt-0.5', active ? 'text-indigo-400' : 'text-slate-400')}>pontos</div>
      {meta && <div className="text-[10px] text-slate-500 mt-2 italic">{meta}</div>}
    </div>
  );
}

function StatusDropdown({
  current,
  onChange,
  loading,
}: {
  current: string;
  onChange: (s: CampanhaEnhanced['status']) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options: CampanhaEnhanced['status'][] = ['rascunho', 'ativa', 'pausada', 'finalizada'];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all',
          STATUS_STYLES[current] || 'bg-slate-100 text-slate-600',
          'border-transparent hover:opacity-80'
        )}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {STATUS_LABELS[current] || current}
        <ChevronDown className="w-3 h-3" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-20 min-w-[160px]"
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors',
                  opt === current ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'
                )}
              >
                {STATUS_LABELS[opt]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ParticipationRow({
  participation,
  usuarios,
  onUpdate,
}: {
  key?: React.Key;
  participation: CampaignParticipation;
  usuarios: Usuario[];
  onUpdate: (id: string, status: CampaignParticipation['status'], notas?: string) => void | Promise<void>;
}) {
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(participation.notas || '');
  const usuario = usuarios.find((u) => u.id === participation.userId);
  const displayName = participation.userName || (usuario ? `${usuario.nome} ${usuario.sobrenome}` : participation.userId);

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
            {displayName[0]}
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm">{displayName}</div>
            <div className="text-xs text-slate-400">{participation.userEmail || usuario?.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        {editingStatus ? (
          <select
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={participation.status}
            autoFocus
            onBlur={() => setEditingStatus(false)}
            onChange={(e) => {
              onUpdate(participation.id, e.target.value as CampaignParticipation['status'], participation.notas);
              setEditingStatus(false);
            }}
          >
            {Object.entries(PARTICIPATION_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => setEditingStatus(true)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-all',
              PARTICIPATION_STYLES[participation.status]
            )}
          >
            {PARTICIPATION_LABELS[participation.status]}
          </button>
        )}
      </td>
      <td className="px-6 py-4">
        {editingNotes ? (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={notes}
              autoFocus
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                onUpdate(participation.id, participation.status, notes);
                setEditingNotes(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdate(participation.id, participation.status, notes);
                  setEditingNotes(false);
                }
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors max-w-[180px] truncate text-left"
          >
            {participation.notas || <span className="text-slate-300 italic">+ Adicionar nota</span>}
          </button>
        )}
      </td>
      <td className="px-6 py-4">
        <span className="text-xs text-slate-400">
          {participation.createdAt?.toDate?.().toLocaleDateString('pt-BR') || '—'}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => setEditingStatus(true)}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          title="Editar status"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function CampanhaEditModal({
  campanha,
  onClose,
  onSuccess,
  onError,
}: {
  campanha: CampanhaEnhanced;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagemUrl, setImagemUrl] = useState(campanha.imagemUrl || '');
  const [form, setForm] = useState({
    nome: campanha.nome || '',
    descricao: campanha.descricao || '',
    empresa: campanha.empresa || '',
    tipo_campanha: campanha.tipo_campanha || campanha.tipo || 'promocional',
    pontos_tier1: (campanha.pontos_tier1 ?? campanha.pontos ?? 0).toString(),
    meta_tier1: campanha.meta_tier1 || '',
    pontos_tier2: campanha.pontos_tier2?.toString() || '',
    meta_tier2: campanha.meta_tier2 || '',
    pontos_tier3: campanha.pontos_tier3?.toString() || '',
    meta_tier3: campanha.meta_tier3 || '',
    limite_por_usuario: campanha.limite_por_usuario?.toString() || '',
    limite_total: campanha.limite_total?.toString() || '',
    atribuicao: campanha.atribuicao || 'todos',
    notas_internas: campanha.notas_internas || '',
    dataInicio: campanha.dataInicio?.toDate?.().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    dataFim: campanha.dataFim?.toDate?.().toISOString().split('T')[0] || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  });

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.nome.trim()) { setError('O nome da campanha é obrigatório.'); return; }
    if (Number(form.pontos_tier1) <= 0) { setError('Os pontos do Tier 1 devem ser maiores que 0.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'campanhas', campanha.id), {
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        empresa: form.empresa.trim(),
        tipo_campanha: form.tipo_campanha,
        tipo: form.tipo_campanha, // keep legacy field in sync
        pontos_tier1: Number(form.pontos_tier1),
        pontos: Number(form.pontos_tier1), // keep legacy field
        meta_tier1: form.meta_tier1.trim(),
        pontos_tier2: form.pontos_tier2 ? Number(form.pontos_tier2) : null,
        meta_tier2: form.meta_tier2.trim(),
        pontos_tier3: form.pontos_tier3 ? Number(form.pontos_tier3) : null,
        meta_tier3: form.meta_tier3.trim(),
        limite_por_usuario: form.limite_por_usuario ? Number(form.limite_por_usuario) : null,
        limite_total: form.limite_total ? Number(form.limite_total) : null,
        atribuicao: form.atribuicao,
        notas_internas: form.notas_internas.trim(),
        imagemUrl: imagemUrl || null,
        dataInicio: Timestamp.fromDate(new Date(form.dataInicio)),
        dataFim: Timestamp.fromDate(new Date(form.dataFim)),
        updatedAt: serverTimestamp(),
      });
      onSuccess('Campanha atualizada com sucesso!');
    } catch (err) {
      console.error(err);
      const msg = 'Erro ao atualizar campanha.';
      setError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-900">Editar Campanha</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <form id="edit-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Image */}
            <ImageUploadField
              value={imagemUrl}
              onChange={setImagemUrl}
              storagePath={`campanhas/${campanha.id}/banner`}
            />

            {/* Basic */}
            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Informações Básicas</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => set('nome', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Empresa</label>
                  <input
                    type="text"
                    value={form.empresa}
                    onChange={(e) => set('empresa', e.target.value)}
                    placeholder="Ex: Empresa XYZ"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Campanha</label>
                  <select
                    value={form.tipo_campanha}
                    onChange={(e) => set('tipo_campanha', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="indicacao">Indicação</option>
                    <option value="venda_direta">Venda Direta</option>
                    <option value="ativacao">Ativação</option>
                    <option value="retencao">Retenção</option>
                    <option value="acao_manual">Ação Manual</option>
                    <option value="bonus">Bônus</option>
                    <option value="promocional">Promocional</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                  <textarea
                    value={form.descricao}
                    onChange={(e) => set('descricao', e.target.value)}
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Tiers */}
            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recompensas</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([1, 2, 3] as const).map((tier) => (
                  <div key={tier} className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="text-xs font-bold text-slate-600 uppercase">Tier {tier}{tier === 1 ? ' *' : ''}</div>
                    <div>
                      <label className="text-[11px] text-slate-500">Pontos</label>
                      <input
                        type="number"
                        min={tier === 1 ? '1' : '0'}
                        value={form[`pontos_tier${tier}` as keyof typeof form]}
                        onChange={(e) => set(`pontos_tier${tier}`, e.target.value)}
                        required={tier === 1}
                        placeholder={tier === 1 ? 'Obrigatório' : 'Opcional'}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500">Meta / Condição</label>
                      <input
                        type="text"
                        value={form[`meta_tier${tier}` as keyof typeof form]}
                        onChange={(e) => set(`meta_tier${tier}`, e.target.value)}
                        placeholder="Ex: 1ª venda do mês"
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Dates & Limits */}
            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Período e Limites</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Início *</label>
                  <input
                    type="date"
                    value={form.dataInicio}
                    onChange={(e) => set('dataInicio', e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fim *</label>
                  <input
                    type="date"
                    value={form.dataFim}
                    onChange={(e) => set('dataFim', e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Limite/Usuário</label>
                  <input
                    type="number"
                    min="0"
                    value={form.limite_por_usuario}
                    onChange={(e) => set('limite_por_usuario', e.target.value)}
                    placeholder="Sem limite"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Limite Total</label>
                  <input
                    type="number"
                    min="0"
                    value={form.limite_total}
                    onChange={(e) => set('limite_total', e.target.value)}
                    placeholder="Sem limite"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            </section>

            {/* Assignment */}
            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Atribuição</h4>
              <div className="flex gap-3">
                {(['todos', 'especificos', 'grupos'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set('atribuicao', opt)}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all',
                      form.atribuicao === opt
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                    )}
                  >
                    {opt === 'todos' ? 'Todos' : opt === 'especificos' ? 'Específicos' : 'Grupos'}
                  </button>
                ))}
              </div>
            </section>

            {/* Internal notes */}
            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Notas Internas</h4>
              <textarea
                value={form.notas_internas}
                onChange={(e) => set('notas_internas', e.target.value)}
                rows={3}
                placeholder="Visível apenas para administradores..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </section>
          </form>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            form="edit-form"
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar Alterações
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
