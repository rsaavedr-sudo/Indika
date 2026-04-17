import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import WithdrawPage from './WithdrawPage';
import StatementPage from './StatementPage';
import UserSettings from './UserSettings';
import { getFaixaByPontos, getFaixaProgress, getPontosParaProxima, DEFAULT_FAIXAS } from '../../utils/faixas';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowUpCircle,
  ArrowDownCircle,
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Building2,
  Gift,
  Home,
  LayoutDashboard,
  Layers,
  Loader2,
  LogOut,
  Menu,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
  BadgeCheck,
  Hourglass,
  CircleSlash,
  Trophy,
  DollarSign,
  ReceiptText,
  Settings,
  ClipboardList,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transacao {
  id: string;
  pontos: number;
  tipo: 'credito' | 'debito';
  origem: string;
  descricao: string;
  createdAt: any;
  saldoNovo?: number;
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
  imagemUrl?: string;
  atribuicao?: string;
  dataInicio: any;
  dataFim: any;
  status: string;
}

interface Participation {
  id: string;
  campanhaId: string;
  userId: string;
  status: 'registrado' | 'contactado' | 'venda_realizada' | 'rechazado' | 'available' | 'accepted' | 'rejected' | 'completed';
  notas?: string;
  createdAt: any;
}

interface Missao {
  id: string;
  nome: string;
  descricao: string;
  imagemUrl?: string;
  tipo: 'simples' | 'progressiva' | 'viral' | 'engagement';
  pontos: number;
  meta: number;
  dataInicio: any;
  dataFim: any;
  status: 'ativa' | 'inativa';
  faixaMinima?: string;
}

interface MissaoParticipation {
  id: string;
  missaoId: string;
  userId: string;
  progresso: number;
  concluida: boolean;
  createdAt: any;
}

type Section = 'home' | 'campanhas' | 'missoes' | 'comprar' | 'loja' | 'sacar' | 'extrato' | 'configuracoes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PART_LABELS: Record<string, string> = {
  registrado: 'Inscrito',
  contactado: 'Em Contato',
  venda_realizada: 'Concluída',
  rechazado: 'Recusado',
  available: 'Disponível',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
  completed: 'Concluída',
};

const PART_STYLES: Record<string, string> = {
  registrado: 'bg-slate-100 text-slate-600 border-slate-200',
  contactado: 'bg-blue-50 text-blue-700 border-blue-200',
  venda_realizada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rechazado: 'bg-red-50 text-red-600 border-red-200',
  available: 'bg-slate-100 text-slate-600 border-slate-200',
  accepted: 'bg-blue-50 text-blue-700 border-blue-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const PART_ICONS: Record<string, React.ReactNode> = {
  registrado: <Hourglass className="w-3 h-3" />,
  contactado: <TrendingUp className="w-3 h-3" />,
  venda_realizada: <BadgeCheck className="w-3 h-3" />,
  rechazado: <CircleSlash className="w-3 h-3" />,
  available: <Target className="w-3 h-3" />,
  accepted: <CheckCircle2 className="w-3 h-3" />,
  rejected: <CircleSlash className="w-3 h-3" />,
  completed: <BadgeCheck className="w-3 h-3" />,
};

function effectivePontos(c: Campanha) { return c.pontos_tier1 ?? c.pontos ?? 0; }

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode; dividerBefore?: boolean }[] = [
  { id: 'home',      label: 'Início',         icon: <Home className="w-[18px] h-[18px]" /> },
  { id: 'campanhas', label: 'Campanhas',       icon: <Layers className="w-[18px] h-[18px]" /> },
  { id: 'missoes',   label: 'Missões',         icon: <Target className="w-[18px] h-[18px]" /> },
  { id: 'comprar',   label: 'Comprar Pontos',  icon: <Sparkles className="w-[18px] h-[18px]" /> },
  { id: 'loja',      label: 'Loja Virtual',    icon: <Gift className="w-[18px] h-[18px]" /> },
  { id: 'sacar',          label: 'Sacar Pontos',    icon: <DollarSign className="w-[18px] h-[18px]" />, dividerBefore: true },
  { id: 'extrato',        label: 'Extrato',         icon: <ReceiptText className="w-[18px] h-[18px]" /> },
  { id: 'configuracoes',  label: 'Configurações',   icon: <Settings className="w-[18px] h-[18px]" /> },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserDashboard() {
  const { profile, user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamp, setSelectedCamp] = useState<Campanha | null>(null);
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeSection = (searchParams.get('s') as Section) || 'home';
  const setSection = (s: Section) => {
    setSearchParams({ s });
    setSidebarOpen(false);
  };

  // ── Hooks must all be declared before any conditional return ──────────────

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;

    const qTrans = query(
      collection(db, 'transacoes_pontos'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubTrans = onSnapshot(
      qTrans,
      snap => setTransacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Transacao[]),
      err => console.warn('[UserDashboard] transacoes listener:', err.message)
    );

    const qCamps = query(
      collection(db, 'campanhas'),
      where('status', '==', 'ativa'),
      orderBy('createdAt', 'desc')
    );
    const unsubCamps = onSnapshot(
      qCamps,
      snap => {
        setCampanhas(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campanha[]);
        setLoading(false);
      },
      err => {
        console.warn('[UserDashboard] campanhas listener:', err.message);
        setLoading(false);
      }
    );

    const qPart = query(
      collection(db, 'campaign_participations'),
      where('userId', '==', user.uid)
    );
    const unsubPart = onSnapshot(
      qPart,
      snap => setParticipations(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Participation[]),
      err => console.warn('[UserDashboard] participations listener:', err.message)
    );

    return () => { unsubTrans(); unsubCamps(); unsubPart(); };
  }, [user]);

  const handleParticipate = async (camp: Campanha) => {
    if (!user || !profile) return;
    if (participations.find(p => p.campanhaId === camp.id)) { setSelectedCamp(null); return; }
    setJoining(true);
    try {
      await addDoc(collection(db, 'campaign_participations'), {
        campanhaId: camp.id,
        userId: user.uid,
        userName: `${profile.nome} ${profile.sobrenome}`,
        userEmail: profile.email || '',
        organizationId: profile.organizationId,
        status: 'accepted',
        notas: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setToast({ msg: `Aceitou "${camp.nome}"!`, ok: true });
      setSelectedCamp(null);
    } catch {
      setToast({ msg: 'Erro ao participar. Tente novamente.', ok: false });
    } finally {
      setJoining(false);
    }
  };

  const handleReject = async (camp: Campanha) => {
    if (!user || !profile) return;
    setJoining(true);
    try {
      await addDoc(collection(db, 'campaign_participations'), {
        campanhaId: camp.id,
        userId: user.uid,
        userName: `${profile.nome} ${profile.sobrenome}`,
        userEmail: profile.email || '',
        organizationId: profile.organizationId,
        status: 'rejected',
        notas: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setToast({ msg: `Rejeitou "${camp.nome}".`, ok: true });
      setSelectedCamp(null);
    } catch {
      setToast({ msg: 'Erro ao rejeitar. Tente novamente.', ok: false });
    } finally {
      setJoining(false);
    }
  };

  // ── Safe conditional returns AFTER all hooks ─────────────────────────────
  if (!authLoading && !user) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-[#0A2540] rounded-xl flex items-center justify-center">
            <span className="text-[#60A5FA] font-bold text-xs">武</span>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-white/50" />
        </div>
      </div>
    );
  }

  const activeCampanhas = campanhas.filter(c => !participations.find(p => p.campanhaId === c.id && (p.status === 'rechazado' || p.status === 'rejected')));
  const myCampanhas = campanhas.filter(c => participations.find(p => p.campanhaId === c.id));
  const pontos = profile?.pontos || 0;
  const faixa = getFaixaByPontos(pontos, DEFAULT_FAIXAS);
  const progress = getFaixaProgress(pontos, faixa);
  const pontosRestantes = getPontosParaProxima(pontos, faixa);
  const faixaIdx = DEFAULT_FAIXAS.findIndex(f => f.id === faixa.id);
  const nextFaixa = DEFAULT_FAIXAS[faixaIdx + 1] || null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">

      {/* ── Sidebar overlay (mobile) ─────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ──────────────────────────── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-60 bg-[#0A2540] border-r border-blue-900/20 flex flex-col transition-transform duration-300 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>

        {/* Brand */}
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-blue-800/30">
          <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
            <span className="text-[13px] font-light text-[#60A5FA]">武</span>
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">Indika</span>
        </div>

        {/* User info */}
        <div className="px-4 pt-4 pb-3 border-b border-blue-800/30">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[#60A5FA] font-bold text-xs">
                {(profile?.nome?.[0] || '?').toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">{profile?.nome} {profile?.sobrenome}</p>
              <p className="text-[11px] text-white/70 truncate">{profile?.email}</p>
            </div>
          </div>
          {/* Points + faixa */}
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-white/70 uppercase tracking-widest mb-0.5">Pontos</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-[#60A5FA] leading-none">{pontos.toLocaleString('pt-BR')}</span>
              <span className="text-[11px] text-white/80">pts</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-sm">{faixa.emoji}</span>
              <span className="text-[11px] font-medium text-white/70">{faixa.nome}</span>
            </div>
            {/* mini progress bar */}
            <div className="w-full bg-blue-900/40 rounded-full h-1 mt-2 overflow-hidden">
              <div className="h-full bg-[#60A5FA] rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <React.Fragment key={item.id}>
              {item.dividerBefore && <div className="border-t border-blue-800/30 my-2" />}
              <button
                onClick={() => setSection(item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left',
                  activeSection === item.id
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                )}
              >
                <span className={activeSection === item.id ? 'text-white' : 'text-white/70'}>
                  {item.icon}
                </span>
                {item.label}
                {item.id === 'campanhas' && myCampanhas.length > 0 && (
                  <span className={cn(
                    'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    activeSection === item.id ? 'bg-blue-400/30 text-white' : 'bg-blue-900/30 text-white/80'
                  )}>{myCampanhas.length}</span>
                )}
              </button>
            </React.Fragment>
          ))}

          {profile?.role === 'admin' && (
            <Link
              to="/admin"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-white/80 hover:text-white hover:bg-white/5 transition-all mt-2 border-t border-blue-800/30 pt-3"
            >
              <LayoutDashboard className="w-[18px] h-[18px]" />
              Painel Admin
            </Link>
          )}
        </nav>

        {/* Logout */}
        <div className="p-2.5 border-t border-blue-800/30">
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-white/80 hover:text-red-300 hover:bg-red-900/20 transition-all"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-60">

        {/* Top bar (mobile) */}
        <header className="lg:hidden h-14 bg-[#0A2540] border-b border-blue-900/20 flex items-center justify-between px-4 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-white/70 hover:bg-white/5 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
              <span className="text-[#60A5FA] font-light text-xs">武</span>
            </div>
            <span className="font-bold text-white text-sm">Indika</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg border border-blue-400/20">
            <Award className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span className="text-xs font-bold text-[#60A5FA]">{pontos.toLocaleString('pt-BR')}</span>
          </div>
        </header>

        {/* ── Hero ─────────────────────────────── */}
        <div className="bg-[#0A2540] relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-[320px] h-[320px] bg-[#1E3A8A] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-[#1E3A8A] rounded-full translate-y-1/2 pointer-events-none opacity-50" />

          <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-6">
            <p className="text-white/70 text-sm font-medium mb-4">
              Olá, <span className="text-white">{profile?.nome}</span>
            </p>

            <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mb-8">
              {/* Big points */}
              <div>
                <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Pontos acumulados</p>
                <div className="flex items-end gap-2">
                  <span className="text-6xl font-black text-[#60A5FA] tracking-tighter leading-none">
                    {pontos.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-white/80 text-lg mb-1">pts</span>
                </div>
              </div>
              {/* Divider */}
              <div className="hidden sm:block w-px h-12 bg-blue-900/40" />
              {/* Stats */}
              <div className="flex gap-6">
                <div>
                  <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Campanhas</p>
                  <p className="text-3xl font-bold text-white">{activeCampanhas.length}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Participações</p>
                  <p className="text-3xl font-bold text-white">{participations.length}</p>
                </div>
              </div>
            </div>

            {/* Faixa progress bar */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-lg">{faixa.emoji}</span>
                <span className="text-sm font-semibold text-white">{faixa.nome}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="w-full bg-blue-900/40 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                    className="h-full bg-[#60A5FA] rounded-full"
                  />
                </div>
              </div>
              {nextFaixa ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-sm opacity-40">{nextFaixa.emoji}</span>
                  <span className="text-[11px] text-white/80">
                    {pontosRestantes.toLocaleString('pt-BR')} pts
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-[#60A5FA] font-semibold flex-shrink-0">Nível máximo</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Mobile bottom nav ────────────────── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 flex">
          {NAV_ITEMS.slice(0, 5).map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[9px] font-medium transition-colors',
                activeSection === item.id ? 'text-[#0A2540]' : 'text-slate-400'
              )}
            >
              <span className={cn(
                'w-8 h-7 flex items-center justify-center rounded-lg transition-colors',
                activeSection === item.id ? 'bg-blue-50' : ''
              )}>{item.icon}</span>
              {item.label.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* ── Content area ─────────────────────── */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 pb-24 lg:pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {activeSection === 'home' && (
                <HomeSection
                  campanhas={activeCampanhas}
                  participations={participations}
                  onSelect={setSelectedCamp}
                  onNavigateCampanhas={() => setSection('campanhas')}
                />
              )}
              {activeSection === 'campanhas' && (
                <MyCampanhasSection
                  campanhas={campanhas}
                  participations={participations}
                  onSelect={setSelectedCamp}
                  onBrowse={() => setSection('home')}
                />
              )}
              {activeSection === 'comprar' && <ComprarSection />}
              {activeSection === 'loja' && <LojaSection />}
              {activeSection === 'missoes' && (
                <MissoesSection userId={user?.uid || ''} pontos={pontos} />
              )}
              {activeSection === 'sacar' && <WithdrawPage />}
              {activeSection === 'extrato' && <StatementPage />}
              {activeSection === 'configuracoes' && <UserSettings />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Toast ──────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              'fixed bottom-24 lg:bottom-8 left-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl font-semibold flex items-center gap-2.5 text-sm min-w-[260px] justify-center',
              toast.ok ? 'bg-[#0A2540] text-white' : 'bg-red-600 text-white'
            )}
          >
            {toast.ok
              ? <CheckCircle2 className="w-4 h-4 text-[#60A5FA] flex-shrink-0" />
              : <X className="w-4 h-4 flex-shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Campaign detail modal ─────────────── */}
      <AnimatePresence>
        {selectedCamp && (
          <CampaignModal
            camp={selectedCamp}
            participation={participations.find(p => p.campanhaId === selectedCamp.id)}
            joining={joining}
            onClose={() => setSelectedCamp(null)}
            onParticipate={() => handleParticipate(selectedCamp)}
            onReject={() => handleReject(selectedCamp)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Home Section ─────────────────────────────────────────────────────────────

function HomeSection({
  campanhas,
  participations,
  onSelect,
  onNavigateCampanhas,
}: {
  campanhas: Campanha[];
  participations: Participation[];
  onSelect: (c: Campanha) => void;
  onNavigateCampanhas: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Campanhas disponíveis</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Participe e acumule pontos</p>
        </div>
        {campanhas.length > 0 && (
          <span className="text-xs font-semibold text-zinc-400 bg-stone-100 px-2.5 py-1 rounded-full">
            {campanhas.length} ativa{campanhas.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {campanhas.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-10 h-10" />}
          title="Nenhuma campanha ativa"
          subtitle="Volte em breve para novas oportunidades."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {campanhas.map(camp => (
            <CampaignCard
              key={camp.id}
              camp={camp}
              participation={participations.find(p => p.campanhaId === camp.id)}
              onClick={() => onSelect(camp)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle, action }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-zinc-300">
      <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-1">
        {icon}
      </div>
      <p className="font-semibold text-zinc-500 text-sm">{title}</p>
      {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
      {action}
    </div>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({
  camp,
  participation,
  onClick,
}: {
  key?: React.Key;
  camp: Campanha;
  participation?: Participation;
  onClick: () => void;
}) {
  const pontos = effectivePontos(camp);
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="bg-white rounded-xl border border-blue-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
    >
      {/* Image */}
      <div className="relative w-full bg-slate-100" style={{ height: 160 }}>
        {camp.imagemUrl ? (
          <img
            src={camp.imagemUrl}
            alt={camp.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers className="w-10 h-10 text-slate-300" />
          </div>
        )}
        {/* Points badge */}
        <div className="absolute top-3 left-3">
          <span className="flex items-center gap-1 px-2 py-1 bg-[#0A2540]/90 backdrop-blur-sm text-[#60A5FA] text-xs font-bold rounded-lg">
            <Zap className="w-3 h-3" />+{pontos} pts
          </span>
        </div>
        {/* Participation badge */}
        {participation && (
          <div className="absolute top-3 right-3">
            <span className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border backdrop-blur-sm',
              PART_STYLES[participation.status]
            )}>
              {PART_ICONS[participation.status]}
              {PART_LABELS[participation.status]}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4">
        {camp.empresa && (
          <p className="text-[11px] text-slate-500 flex items-center gap-1 mb-1">
            <Building2 className="w-3 h-3" />{camp.empresa}
          </p>
        )}
        <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1 line-clamp-1">{camp.nome}</h3>
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">{camp.descricao}</p>

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            até {camp.dataFim?.toDate?.().toLocaleDateString('pt-BR') || '—'}
          </p>
          {participation ? (
            <span className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border', PART_STYLES[participation.status])}>
              {PART_ICONS[participation.status]}{PART_LABELS[participation.status]}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-[#0A2540] text-white rounded-lg group-hover:bg-[#1E3A8A] transition-colors">
              Participar <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── My Campaigns Section ─────────────────────────────────────────────────────

function MyCampanhasSection({
  campanhas,
  participations,
  onSelect,
  onBrowse,
}: {
  campanhas: Campanha[];
  participations: Participation[];
  onSelect: (c: Campanha) => void;
  onBrowse: () => void;
}) {
  const joined = participations
    .map(p => {
      const camp = campanhas.find(c => c.id === p.campanhaId);
      return camp ? { camp, participation: p } : null;
    })
    .filter(Boolean) as { camp: Campanha; participation: Participation }[];

  const inProgress = joined.filter(j => ['registrado', 'contactado', 'accepted'].includes(j.participation.status));
  const completed   = joined.filter(j => ['venda_realizada', 'completed'].includes(j.participation.status));
  const rejected    = joined.filter(j => ['rechazado', 'rejected'].includes(j.participation.status));

  if (joined.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-zinc-900">Minhas Campanhas</h2>
        <EmptyState
          icon={<Layers className="w-10 h-10" />}
          title="Você ainda não participou de nenhuma campanha."
          action={
            <button
              onClick={onBrowse}
              className="mt-1 px-5 py-2 bg-zinc-900 text-white text-sm font-bold rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Ver campanhas disponíveis
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-zinc-900">Minhas Campanhas</h2>

      {inProgress.length > 0 && (
        <CampaignGroup title="Em andamento" count={inProgress.length} color="amber">
          {inProgress.map(({ camp, participation }) => (
            <CampaignListRow key={participation.id} camp={camp} participation={participation} onClick={() => onSelect(camp)} />
          ))}
        </CampaignGroup>
      )}
      {completed.length > 0 && (
        <CampaignGroup title="Concluídas" count={completed.length} color="emerald">
          {completed.map(({ camp, participation }) => (
            <CampaignListRow key={participation.id} camp={camp} participation={participation} onClick={() => onSelect(camp)} />
          ))}
        </CampaignGroup>
      )}
      {rejected.length > 0 && (
        <CampaignGroup title="Recusadas" count={rejected.length} color="red">
          {rejected.map(({ camp, participation }) => (
            <CampaignListRow key={participation.id} camp={camp} participation={participation} onClick={() => onSelect(camp)} />
          ))}
        </CampaignGroup>
      )}
    </div>
  );
}

function CampaignGroup({ title, count, color, children }: {
  title: string; count: number; color: string; children: React.ReactNode;
}) {
  const pills: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</h3>
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', pills[color])}>{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CampaignListRow({
  camp,
  participation,
  onClick,
}: {
  key?: React.Key;
  camp: Campanha;
  participation: Participation;
  onClick: () => void;
}) {
  return (
    <motion.div
      whileHover={{ x: 2 }}
      onClick={onClick}
      className="flex items-center gap-3 bg-white rounded-xl border border-blue-100 overflow-hidden p-3 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all"
    >
      {camp.imagemUrl ? (
        <img src={camp.imagemUrl} alt={camp.nome} className="w-12 h-10 object-cover rounded-lg flex-shrink-0" />
      ) : (
        <div className="w-12 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Layers className="w-4 h-4 text-slate-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-sm truncate">{camp.nome}</p>
        {camp.empresa && <p className="text-xs text-slate-500 truncate">{camp.empresa}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg border', PART_STYLES[participation.status])}>
          {PART_ICONS[participation.status]}{PART_LABELS[participation.status]}
        </span>
        <span className="text-[11px] text-blue-700 font-bold">+{effectivePontos(camp)} pts</span>
      </div>
    </motion.div>
  );
}

// ─── Historial Section ────────────────────────────────────────────────────────

function HistorialSection({ transacoes }: { transacoes: Transacao[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-zinc-900">Histórico de Pontos</h2>
        <p className="text-sm text-zinc-400 mt-0.5">Todas as movimentações da sua conta</p>
      </div>

      {transacoes.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-10 h-10" />}
          title="Nenhuma movimentação ainda."
          subtitle="Seus créditos e débitos aparecerão aqui."
        />
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="divide-y divide-stone-100">
            {transacoes.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors">
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                  t.tipo === 'credito' ? 'bg-emerald-50' : 'bg-red-50'
                )}>
                  {t.tipo === 'credito'
                    ? <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                    : <ArrowDownCircle className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800 truncate">{t.descricao}</p>
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {t.createdAt?.toDate?.().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) || '—'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn('text-sm font-bold', t.tipo === 'credito' ? 'text-emerald-600' : 'text-red-500')}>
                    {t.tipo === 'credito' ? '+' : '−'}{t.pontos}
                  </p>
                  {t.saldoNovo !== undefined && (
                    <p className="text-[11px] text-zinc-400">saldo: {t.saldoNovo}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Comprar Pontos Section ───────────────────────────────────────────────────

const PLANS = [
  { name: 'Starter',    pts: 1_000,  price: 'R$ 49',  highlight: false },
  { name: 'Pro',        pts: 5_000,  price: 'R$ 199', highlight: true  },
  { name: 'Enterprise', pts: 20_000, price: 'R$ 699', highlight: false },
];

function ComprarSection() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-900">Comprar Pontos</h2>
        <p className="text-sm text-zinc-400 mt-0.5">Amplie seu saldo e acesse mais benefícios.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className={cn(
              'relative rounded-xl border p-5 flex flex-col items-center text-center gap-3 opacity-70',
              plan.highlight
                ? 'border-amber-300 bg-amber-50'
                : 'border-stone-200 bg-white'
            )}
          >
            {plan.highlight && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-bold uppercase px-3 py-0.5 rounded-full">
                Mais popular
              </span>
            )}
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              plan.highlight ? 'bg-amber-100' : 'bg-stone-100'
            )}>
              <Sparkles className={cn('w-5 h-5', plan.highlight ? 'text-amber-600' : 'text-zinc-400')} />
            </div>
            <p className="font-bold text-zinc-700 text-sm">{plan.name}</p>
            <p className="text-2xl font-black text-amber-600">{plan.pts.toLocaleString('pt-BR')}<span className="text-sm text-zinc-400 font-semibold"> pts</span></p>
            <p className="text-lg font-bold text-zinc-800">{plan.price}</p>
            <div className="w-full py-2 rounded-lg bg-stone-200 text-zinc-400 text-xs font-bold cursor-not-allowed">
              Em breve
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-stone-100 rounded-xl text-sm text-zinc-500 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-zinc-400" />
        <p>A funcionalidade de compra estará disponível em breve. Fique de olho nas novidades!</p>
      </div>
    </div>
  );
}

// ─── Loja Virtual Section ─────────────────────────────────────────────────────

const LOJA_PLACEHOLDER = [
  { name: 'Vale Presente R$50',  pts: 2_000,  emoji: '🎁' },
  { name: 'Dia de Folga Extra',  pts: 5_000,  emoji: '🏖️' },
  { name: 'Voucher Amazon R$100',pts: 4_000,  emoji: '📦' },
  { name: 'Ingresso de Cinema',  pts: 1_500,  emoji: '🎬' },
  { name: 'Kit Wellness',        pts: 3_500,  emoji: '💆' },
  { name: 'Curso Online',        pts: 6_000,  emoji: '🎓' },
];

function LojaSection() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-zinc-900">Loja Virtual</h2>
        <p className="text-sm text-zinc-400 mt-0.5">Troque seus pontos por recompensas exclusivas.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {LOJA_PLACEHOLDER.map(item => (
          <div
            key={item.name}
            className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col items-center gap-3 text-center opacity-60 cursor-not-allowed"
          >
            <span className="text-3xl">{item.emoji}</span>
            <p className="text-xs font-semibold text-zinc-700 leading-tight">{item.name}</p>
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
              <Award className="w-3 h-3 text-amber-500" />
              <span className="text-[11px] font-bold text-amber-700">{item.pts.toLocaleString('pt-BR')} pts</span>
            </div>
            <div className="w-full py-1.5 bg-stone-100 text-zinc-400 text-[11px] font-bold rounded-lg cursor-not-allowed">
              Em breve
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-stone-100 rounded-xl text-sm text-zinc-500 flex items-start gap-2.5">
        <Gift className="w-4 h-4 flex-shrink-0 mt-0.5 text-zinc-400" />
        <p>A loja está sendo preparada com novos benefícios. Em breve você poderá resgatar seus pontos!</p>
      </div>
    </div>
  );
}

// ─── Missoes Section ──────────────────────────────────────────────────────────

const MISSAO_TIPO_LABELS: Record<string, string> = {
  simples: 'Simples',
  progressiva: 'Progressiva',
  viral: 'Viral',
  engagement: 'Engajamento',
};

const MISSAO_TIPO_COLORS: Record<string, string> = {
  simples: 'bg-zinc-100 text-zinc-600',
  progressiva: 'bg-violet-50 text-violet-600',
  viral: 'bg-pink-50 text-pink-600',
  engagement: 'bg-amber-50 text-amber-600',
};

function MissoesSection({ userId, pontos }: { userId: string; pontos: number }) {
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [participacoes, setParticipacoes] = useState<MissaoParticipation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'missoes'),
      where('status', '==', 'ativa'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setMissoes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Missao[]);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'mission_participations'),
      where('userId', '==', userId)
    );
    const unsub = onSnapshot(q, snap => {
      setParticipacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as MissaoParticipation[]);
    });
    return unsub;
  }, [userId]);

  const faixaAtual = getFaixaByPontos(pontos, DEFAULT_FAIXAS);
  const faixaOrder = ['branca', 'azul', 'roxa', 'marrom', 'preta'];
  const accessibleMissoes = missoes.filter(m => {
    if (!m.faixaMinima) return true;
    return faixaOrder.indexOf(faixaAtual.id) >= faixaOrder.indexOf(m.faixaMinima);
  });

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Missões</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Complete e ganhe pontos extras</p>
        </div>
        <div className="flex items-center gap-1.5 bg-stone-100 px-2.5 py-1 rounded-full">
          <span className="text-sm">{faixaAtual.emoji}</span>
          <span className="text-[11px] font-semibold text-zinc-600">{faixaAtual.nome}</span>
        </div>
      </div>

      {accessibleMissoes.length === 0 ? (
        <EmptyState
          icon={<Target className="w-10 h-10" />}
          title="Nenhuma missão disponível"
          subtitle="Continue participando para desbloquear missões!"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accessibleMissoes.map(missao => {
            const part = participacoes.find(p => p.missaoId === missao.id);
            const progresso = part?.progresso || 0;
            const concluida = part?.concluida || false;
            const pct = Math.min(100, Math.round((progresso / (missao.meta || 1)) * 100));

            return (
              <div
                key={missao.id}
                className={cn(
                  'bg-white rounded-xl border overflow-hidden transition-all',
                  concluida
                    ? 'border-emerald-200 opacity-75'
                    : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'
                )}
              >
                {missao.imagemUrl ? (
                  <div className="w-full h-24 overflow-hidden">
                    <img src={missao.imagemUrl} alt={missao.nome} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-10 bg-gradient-to-r from-zinc-950 to-zinc-800" />
                )}

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-zinc-900 text-sm">{missao.nome}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{missao.descricao}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs font-bold text-amber-600">+{missao.pontos} pts</span>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', MISSAO_TIPO_COLORS[missao.tipo])}>
                        {MISSAO_TIPO_LABELS[missao.tipo]}
                      </span>
                    </div>
                  </div>

                  {missao.tipo === 'progressiva' && (
                    <div>
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1.5">
                        <span>{progresso} / {missao.meta}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', concluida ? 'bg-emerald-500' : 'bg-amber-500')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      até {missao.dataFim?.toDate?.().toLocaleDateString('pt-BR') || '—'}
                    </p>
                    {concluida ? (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Concluída
                      </span>
                    ) : part ? (
                      <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Em progresso
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Não iniciada
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Campaign Detail Modal ────────────────────────────────────────────────────

function CampaignModal({
  camp,
  participation,
  joining,
  onClose,
  onParticipate,
  onReject,
}: {
  camp: Campanha;
  participation?: Participation;
  joining: boolean;
  onClose: () => void;
  onParticipate: () => void;
  onReject: () => void;
}) {
  const pontos = effectivePontos(camp);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 48 }}
        transition={{ type: 'spring', damping: 30, stiffness: 380 }}
        className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Banner */}
        <div className="relative flex-shrink-0" style={{ height: camp.imagemUrl ? 200 : 0 }}>
          {camp.imagemUrl && (
            <>
              <img src={camp.imagemUrl} alt={camp.nome} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-5">
                <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 bg-[#0A2540]/90 backdrop-blur-sm text-[#60A5FA] text-sm font-bold rounded-lg mb-2">
                  <Zap className="w-3.5 h-3.5" />+{pontos} pts
                </span>
                <h3 className="text-xl font-bold text-white leading-tight">{camp.nome}</h3>
              </div>
            </>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {!camp.imagemUrl && (
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{camp.nome}</h3>
                <span className="flex items-center gap-1 text-sm font-bold text-blue-700 mt-1">
                  <Zap className="w-4 h-4" />+{pontos} pts
                </span>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          )}

          {camp.empresa && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-3">
              <Building2 className="w-3 h-3" />{camp.empresa}
            </p>
          )}
          <p className="text-sm text-slate-600 leading-relaxed mb-4">{camp.descricao}</p>

          <div className="space-y-2 mb-4">
            {[
              camp.meta_tier1 && { label: 'Meta', val: camp.meta_tier1 },
              camp.pontos_tier2 && { label: 'Tier 2', val: `${camp.pontos_tier2} pts — ${camp.meta_tier2 || ''}` },
              camp.pontos_tier3 && { label: 'Tier 3', val: `${camp.pontos_tier3} pts — ${camp.meta_tier3 || ''}` },
            ].filter(Boolean).map((row: any) => (
              <div key={row.label} className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 w-14 flex-shrink-0">{row.label}</span>
                <span className="text-slate-700 font-medium">{row.val}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 w-14 flex-shrink-0">Período</span>
              <span className="text-slate-700 font-medium">
                {camp.dataInicio?.toDate?.().toLocaleDateString('pt-BR') || '—'} → {camp.dataFim?.toDate?.().toLocaleDateString('pt-BR') || '—'}
              </span>
            </div>
          </div>

          {participation ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-lg border', PART_STYLES[participation.status])}>
                {PART_ICONS[participation.status]}{PART_LABELS[participation.status]}
              </span>
              <p className="text-xs text-slate-500 mt-2">Você já está participando desta campanha.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onParticipate}
                disabled={joining}
                className="flex-1 py-3 bg-[#0A2540] hover:bg-[#1E3A8A] active:scale-[0.98] text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {joining ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Aceitando...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Aceitar Campanha</>
                )}
              </button>
              <button
                onClick={onReject}
                disabled={joining}
                className="flex-1 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.98] font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {joining ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Recusando...</>
                ) : (
                  <><CircleSlash className="w-4 h-4" /> Rejeitar Campanha</>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
