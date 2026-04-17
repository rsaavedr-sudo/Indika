import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Users, UserCheck, UserX, UserMinus,
  TrendingUp, Target, ShoppingBag, Award,
  ArrowUpCircle, ArrowDownCircle, UserPlus,
  Zap, Trophy, Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Usuario {
  id: string;
  nome: string;
  sobrenome: string;
  pontos: number;
  ativo: boolean;
  createdAt: any;
  organizationId: string;
}

interface Transacao {
  id: string;
  userId: string;
  pontos: number;
  tipo: 'credito' | 'debito';
  descricao: string;
  origem: string;
  createdAt: any;
  userName?: string;
}

interface CampanhaParticipation {
  id: string;
  userId: string;
  userName?: string;
  status: string;
  createdAt: any;
}

interface MissaoParticipation {
  id: string;
  userId: string;
  concluida: boolean;
}

// ─── Mock monthly data (replace with real aggregation when available) ─────────

const MONTHS_LABELS = ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr'];

const MOCK_POINTS_SERIES = [
  { mes: 'Mai', gerados: 6200, canjeados: 800 },
  { mes: 'Jun', gerados: 9100, canjeados: 1200 },
  { mes: 'Jul', gerados: 7800, canjeados: 950 },
  { mes: 'Ago', gerados: 12400, canjeados: 1800 },
  { mes: 'Set', gerados: 10200, canjeados: 2100 },
  { mes: 'Out', gerados: 15600, canjeados: 3200 },
  { mes: 'Nov', gerados: 13800, canjeados: 2900 },
  { mes: 'Dez', gerados: 18200, canjeados: 4100 },
  { mes: 'Jan', gerados: 16500, canjeados: 3800 },
  { mes: 'Fev', gerados: 20100, canjeados: 5200 },
  { mes: 'Mar', gerados: 22400, canjeados: 6100 },
  { mes: 'Abr', gerados: 19800, canjeados: 5500 },
];

const MOCK_AFILIADOS_SERIES = [
  { mes: 'Mai', novos: 8 },
  { mes: 'Jun', novos: 14 },
  { mes: 'Jul', novos: 11 },
  { mes: 'Ago', novos: 19 },
  { mes: 'Set', novos: 16 },
  { mes: 'Out', novos: 24 },
  { mes: 'Nov', novos: 21 },
  { mes: 'Dez', novos: 18 },
  { mes: 'Jan', novos: 28 },
  { mes: 'Fev', novos: 32 },
  { mes: 'Mar', novos: 38 },
  { mes: 'Abr', novos: 29 },
];

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

interface BarChartBar {
  key: string;
  color: string;
  label: string;
}

function BarChart({ data, bars }: { data: Record<string, any>[]; bars: BarChartBar[] }) {
  const W = 520, H = 160, padL = 44, padR = 12, padT = 12, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allVals = data.flatMap(d => bars.map(b => Number(d[b.key]) || 0));
  const maxVal = Math.max(...allVals, 1);

  const getX = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * chartW;
  const getY = (v: number) => padT + (1 - v / maxVal) * chartH;

  const barWidth = Math.max(4, chartW / (data.length * (bars.length + 1)));
  const barGap = barWidth * 0.5;

  // Y axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(p => ({ y: padT + (1 - p) * chartH, val: Math.round(maxVal * p) }));
  const fmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Grid */}
      {ticks.map(t => (
        <g key={t.y}>
          <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="#f1f0ee" strokeWidth="1" />
          <text x={padL - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#a1a1aa">{fmt(t.val)}</text>
        </g>
      ))}
      {/* Bars */}
      {data.map((d, i) => {
        const xBase = getX(i);
        return (
          <g key={i}>
            {bars.map((bar, bIdx) => {
              const val = Number(d[bar.key]) || 0;
              const x = xBase - (barWidth * bars.length) / 2 + bIdx * (barWidth + barGap);
              const y = getY(val);
              const height = chartH - (y - padT);
              return (
                <rect
                  key={`${i}-${bIdx}`}
                  x={x} y={y} width={barWidth} height={height}
                  fill={bar.color}
                  rx="1"
                />
              );
            })}
          </g>
        );
      })}
      {/* X labels */}
      {data.map((d, i) => {
        if (data.length > 12 && i % 2 !== 0) return null;
        return (
          <text key={i} x={getX(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#a1a1aa">
            {d.uf}
          </text>
        );
      })}
    </svg>
  );
}

// ─── SVG Area Chart ────────────────────────────────────────────────────────────

interface ChartLine {
  key: string;
  color: string;
  label: string;
}

function AreaChart({ data, lines }: { data: Record<string, any>[]; lines: ChartLine[] }) {
  const W = 520, H = 160, padL = 44, padR = 12, padT = 12, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allVals = data.flatMap(d => lines.map(l => Number(d[l.key]) || 0));
  const maxVal = Math.max(...allVals, 1);

  const getX = (i: number) => padL + (i / (data.length - 1)) * chartW;
  const getY = (v: number) => padT + (1 - v / maxVal) * chartH;

  const smooth = (key: string) => {
    const pts = data.map((d, i) => ({ x: getX(i), y: getY(Number(d[key]) || 0) }));
    let path = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2;
      path += ` C${cpx},${pts[i - 1].y} ${cpx},${pts[i].y} ${pts[i].x},${pts[i].y}`;
    }
    return path;
  };

  const areaPath = (key: string) => {
    const line = smooth(key);
    const last = data[data.length - 1];
    return `${line} L${getX(data.length - 1)},${padT + chartH} L${padL},${padT + chartH} Z`;
  };

  // Y axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(p => ({ y: padT + (1 - p) * chartH, val: Math.round(maxVal * p) }));
  const fmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Grid */}
      {ticks.map(t => (
        <g key={t.y}>
          <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="#f1f0ee" strokeWidth="1" />
          <text x={padL - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#a1a1aa">{fmt(t.val)}</text>
        </g>
      ))}
      {/* Defs for gradients */}
      <defs>
        {lines.map(line => (
          <linearGradient key={line.key} id={`grad-${line.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={line.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={line.color} stopOpacity="0.02" />
          </linearGradient>
        ))}
      </defs>
      {/* Areas */}
      {lines.map(line => (
        <path key={`area-${line.key}`} d={areaPath(line.key)} fill={`url(#grad-${line.key})`} />
      ))}
      {/* Lines */}
      {lines.map(line => (
        <path key={`line-${line.key}`} d={smooth(line.key)} fill="none" stroke={line.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* Dots at last point */}
      {lines.map(line => {
        const last = data[data.length - 1];
        const x = getX(data.length - 1);
        const y = getY(Number(last[line.key]) || 0);
        return (
          <circle key={`dot-${line.key}`} cx={x} cy={y} r="3.5" fill={line.color} stroke="white" strokeWidth="1.5" />
        );
      })}
      {/* X labels — every 2 months */}
      {data.map((d, i) => {
        if (i % 2 !== 0) return null;
        return (
          <text key={i} x={getX(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#a1a1aa">
            {d.mes}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardAdmin() {
  const { profile } = useAuth();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [participations, setParticipations] = useState<CampanhaParticipation[]>([]);
  const [missaoParticipations, setMissaoParticipations] = useState<MissaoParticipation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.organizationId) return;
    const orgId = profile.organizationId;
    let loadCount = 0;
    const done = () => { loadCount++; if (loadCount >= 2) setLoading(false); };

    const unsubU = onSnapshot(
      query(collection(db, 'usuarios'), where('organizationId', '==', orgId)),
      snap => { setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Usuario[]); done(); }
    );
    const unsubT = onSnapshot(
      query(collection(db, 'transacoes_pontos'), orderBy('createdAt', 'desc'), limit(200)),
      snap => { setTransacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Transacao[]); done(); }
    );
    const unsubP = onSnapshot(
      query(collection(db, 'campaign_participations'), where('organizationId', '==', orgId)),
      snap => setParticipations(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CampanhaParticipation[])
    );
    const unsubM = onSnapshot(
      query(collection(db, 'mission_participations')),
      snap => setMissaoParticipations(snap.docs.map(d => ({ id: d.id, ...d.data() })) as MissaoParticipation[])
    );

    return () => { unsubU(); unsubT(); unsubP(); unsubM(); };
  }, [profile?.organizationId]);

  // ── Computed metrics ────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const ativos   = usuarios.filter(u => u.ativo).length;
    const inativos = usuarios.filter(u => !u.ativo).length;
    const total    = usuarios.length;

    const pontosGerados  = transacoes.filter(t => t.tipo === 'credito').reduce((s, t) => s + (t.pontos || 0), 0);
    const pontosCanjeados = transacoes.filter(t => t.tipo === 'debito').reduce((s, t) => s + (t.pontos || 0), 0);
    const pctCanje = pontosGerados > 0 ? Math.round((pontosCanjeados / pontosGerados) * 100) : 0;

    const vendasEfetivas   = participations.filter(p => p.status === 'venda_realizada').length;
    const missoesCompletas = missaoParticipations.filter(m => m.concluida).length;
    const pctAtivos = total > 0 ? Math.round((ativos / total) * 100) : 0;

    // Rankings
    const topPontos = [...usuarios]
      .sort((a, b) => (b.pontos || 0) - (a.pontos || 0))
      .slice(0, 10);

    const participacoesPorUser: Record<string, number> = {};
    participations.forEach(p => {
      participacoesPorUser[p.userId] = (participacoesPorUser[p.userId] || 0) + 1;
    });
    const topAtivos = [...usuarios]
      .sort((a, b) => (participacoesPorUser[b.id] || 0) - (participacoesPorUser[a.id] || 0))
      .slice(0, 10);

    // Users by state (UF)
    const usuariosPorEstado: Record<string, { ativo: number; inativo: number }> = {};
    usuarios.forEach(u => {
      const uf = u.uf || 'Outros';
      if (!usuariosPorEstado[uf]) {
        usuariosPorEstado[uf] = { ativo: 0, inativo: 0 };
      }
      if (u.ativo) {
        usuariosPorEstado[uf].ativo += 1;
      } else {
        usuariosPorEstado[uf].inativo += 1;
      }
    });

    const estadosOrdenados = Object.entries(usuariosPorEstado)
      .map(([uf, data]) => ({ uf, total: data.ativo + data.inativo, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map(d => ({ uf: d.uf, ativo: d.ativo, inativo: d.inativo }));

    // Recent events (last 8 transactions)
    const recentEvents = transacoes.slice(0, 8);

    return {
      ativos, inativos, cancelados: 0, total,
      pontosGerados, pontosCanjeados, pctCanje,
      vendasEfetivas, missoesCompletas, pctAtivos,
      clientesIndicados: vendasEfetivas,
      topPontos, topAtivos, recentEvents,
      estadosOrdenados,
    };
  }, [usuarios, transacoes, participations, missaoParticipations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
            <Trophy className="w-5 h-5 text-[#60A5FA]" />
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { ativos, inativos, cancelados, total, pontosGerados, pontosCanjeados,
    pctCanje, vendasEfetivas, missoesCompletas, pctAtivos,
    clientesIndicados, topPontos, topAtivos, recentEvents, estadosOrdenados } = metrics;

  return (
    <div className="px-6 py-6 max-w-[1400px] space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Visão geral do programa de fidelidade</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-stone-100 px-3 py-1.5 rounded-full">
          <Activity className="w-3.5 h-3.5" />
          Dados em tempo real
        </div>
      </div>

      {/* ── 1. Barra de Pontos ── */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pontos do Programa</p>
              <p className="text-sm text-zinc-400">Gerados vs. Canjeados</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[11px] text-zinc-400 uppercase tracking-wider">Gerados</p>
              <p className="text-lg font-black text-zinc-900">{pontosGerados.toLocaleString('pt-BR')}</p>
            </div>
            <div className="w-px h-8 bg-stone-200" />
            <div className="text-right">
              <p className="text-[11px] text-emerald-600 uppercase tracking-wider">Canjeados</p>
              <p className="text-lg font-black text-emerald-600">{pontosCanjeados.toLocaleString('pt-BR')}</p>
            </div>
            <div className="w-px h-8 bg-stone-200" />
            <div className="text-right">
              <p className="text-[11px] text-zinc-400 uppercase tracking-wider">% Canje</p>
              <p className="text-lg font-black text-zinc-700">{pctCanje}%</p>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-1000 relative"
            style={{ width: `${Math.max(pctCanje, 1)}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-400" />
          </div>
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-zinc-400">0</span>
          <span className="text-[10px] text-zinc-400">{pontosGerados.toLocaleString('pt-BR')} pts totais</span>
        </div>
      </div>

      {/* ── 2. KPIs Principales (3 cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={<UserCheck className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="Afiliados Ativos"
          value={ativos}
          valueColor="text-emerald-600"
          sub={total > 0 ? `${pctAtivos}% do total` : 'sem dados'}
        />
        <KpiCard
          icon={<UserX className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-50"
          label="Afiliados Inativos"
          value={inativos}
          valueColor="text-blue-600"
          sub={total > 0 ? `${100 - pctAtivos}% do total` : 'sem dados'}
        />
        <KpiCard
          icon={<UserMinus className="w-5 h-5 text-zinc-400" />}
          iconBg="bg-stone-100"
          label="Afiliados Cancelados"
          value={cancelados}
          valueColor="text-zinc-500"
          sub="nenhum registrado"
        />
      </div>

      {/* ── 3. KPIs Secundários (4 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SecondaryKpi
          icon={<TrendingUp className="w-4 h-4" />}
          color="blue"
          label="% Afiliados Ativos"
          value={`${pctAtivos}%`}
        />
        <SecondaryKpi
          icon={<Target className="w-4 h-4" />}
          color="violet"
          label="Missões Completadas"
          value={missoesCompletas.toLocaleString('pt-BR')}
        />
        <SecondaryKpi
          icon={<ShoppingBag className="w-4 h-4" />}
          color="emerald"
          label="Vendas Efetivas"
          value={vendasEfetivas.toLocaleString('pt-BR')}
        />
        <SecondaryKpi
          icon={<Users className="w-4 h-4" />}
          color="amber"
          label="Clientes Indicados"
          value={clientesIndicados.toLocaleString('pt-BR')}
        />
      </div>

      {/* ── 4. Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pontos chart */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Pontos — Últimos 12 meses</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Gerados vs. Canjeados</p>
            </div>
            <div className="flex items-center gap-3">
              <Legend color="#60A5FA" label="Gerados" />
              <Legend color="#10B981" label="Canjeados" />
            </div>
          </div>
          <AreaChart
            data={MOCK_POINTS_SERIES}
            lines={[
              { key: 'gerados',   color: '#60A5FA', label: 'Gerados'   },
              { key: 'canjeados', color: '#10B981', label: 'Canjeados' },
            ]}
          />
        </div>

        {/* Afiliados chart */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Novos Afiliados — Últimos 12 meses</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Cadastros por mês</p>
            </div>
            <Legend color="#1E3A8A" label="Novos" />
          </div>
          <AreaChart
            data={MOCK_AFILIADOS_SERIES}
            lines={[
              { key: 'novos', color: '#1E3A8A', label: 'Novos afiliados' },
            ]}
          />
        </div>
      </div>

      {/* ── 4b. Usuários por Estado ── */}
      {estadosOrdenados.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Usuários Ativos vs Inativos por Estado</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Top {estadosOrdenados.length} estados</p>
            </div>
            <div className="flex items-center gap-3">
              <Legend color="#10B981" label="Ativos" />
              <Legend color="#60A5FA" label="Inativos" />
            </div>
          </div>
          <BarChart
            data={estadosOrdenados}
            bars={[
              { key: 'ativo', color: '#10B981', label: 'Ativos' },
              { key: 'inativo', color: '#60A5FA', label: 'Inativos' },
            ]}
          />
        </div>
      )}

      {/* ── 5. Listas inferiores ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Ranking: atividade */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-900">Mais Ativos</h3>
            <span className="ml-auto text-[10px] text-zinc-400 bg-stone-100 px-1.5 py-0.5 rounded-full">Top 10</span>
          </div>
          <div className="divide-y divide-stone-100">
            {topAtivos.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">Sem dados</p>
            ) : topAtivos.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0',
                  i === 0 ? 'bg-amber-400 text-white' :
                  i === 1 ? 'bg-zinc-300 text-zinc-700' :
                  i === 2 ? 'bg-blue-700/30 text-blue-800' :
                  'bg-stone-100 text-zinc-500'
                )}>{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#60A5FA] text-[10px] font-bold">{u.nome[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-800 truncate">{u.nome} {u.sobrenome}</p>
                </div>
                <span className="text-[10px] font-bold text-zinc-400 flex-shrink-0">
                  {u.pontos || 0} pts
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking: pontos */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-zinc-900">Ranking Pontos</h3>
            <span className="ml-auto text-[10px] text-zinc-400 bg-stone-100 px-1.5 py-0.5 rounded-full">Top 10</span>
          </div>
          <div className="divide-y divide-stone-100">
            {topPontos.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">Sem dados</p>
            ) : topPontos.map((u, i) => {
              const maxPts = topPontos[0]?.pontos || 1;
              const pct = Math.round(((u.pontos || 0) / maxPts) * 100);
              return (
                <div key={u.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0',
                      i === 0 ? 'bg-amber-400 text-white' :
                      i === 1 ? 'bg-zinc-300 text-zinc-700' :
                      i === 2 ? 'bg-blue-700/30 text-blue-800' :
                      'bg-stone-100 text-zinc-500'
                    )}>{i + 1}</span>
                    <p className="text-xs font-semibold text-zinc-800 truncate flex-1">{u.nome} {u.sobrenome}</p>
                    <span className="text-xs font-black text-blue-600 flex-shrink-0">{(u.pontos || 0).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="ml-7 w-full bg-stone-100 rounded-full h-1 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Movimentos recentes */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-900">Movimentos Recentes</h3>
          </div>
          <div className="divide-y divide-stone-100">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">Sem movimentos</p>
            ) : recentEvents.map(t => (
              <div key={t.id} className="flex items-start gap-3 px-5 py-3">
                <div className={cn(
                  'w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                  t.tipo === 'credito' ? 'bg-emerald-50' : 'bg-blue-50'
                )}>
                  {t.tipo === 'credito'
                    ? <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-600" />
                    : <ArrowDownCircle className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-700 truncate">{t.descricao || (t.tipo === 'credito' ? 'Pontos creditados' : 'Pontos resgatados')}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {t.createdAt?.toDate?.().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) || '—'}
                  </p>
                </div>
                <span className={cn(
                  'text-xs font-black flex-shrink-0',
                  t.tipo === 'credito' ? 'text-emerald-600' : 'text-blue-600'
                )}>
                  {t.tipo === 'credito' ? '+' : '−'}{t.pontos}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon, iconBg, label, value, valueColor, sub }: {
  icon: React.ReactNode; iconBg: string; label: string;
  value: number; valueColor: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', iconBg)}>
        {icon}
      </div>
      <p className={cn('text-3xl font-black', valueColor)}>{value.toLocaleString('pt-BR')}</p>
      <p className="text-sm font-semibold text-zinc-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const SECONDARY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  emerald:{ bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500'},
  amber:  { bg: 'bg-blue-50',  text: 'text-blue-700',  dot: 'bg-blue-500'  },
};

function SecondaryKpi({ icon, color, label, value }: {
  icon: React.ReactNode; color: string; label: string; value: string;
}) {
  const c = SECONDARY_COLORS[color] || SECONDARY_COLORS.blue;
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', c.bg)}>
          <span className={c.text}>{icon}</span>
        </div>
        <div className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      </div>
      <p className={cn('text-2xl font-black', c.text)}>{value}</p>
      <p className="text-xs font-medium text-zinc-500 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-zinc-500">{label}</span>
    </div>
  );
}
