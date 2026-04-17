import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, Search, TrendingUp, DollarSign,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransacaoPontos {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  pontos: number;
  valor?: number;
  origem: string;
  descricao?: string;
  status?: string;
  createdAt: Timestamp;
  organizationId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(ts?: Timestamp) {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VendaPontosAdmin() {
  const { profile } = useAuth();
  const [transacoes, setTransacoes] = useState<TransacaoPontos[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!profile?.organizationId) return;
    const q = query(
      collection(db, 'transacoes_pontos'),
      where('organizationId', '==', profile.organizationId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setTransacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as TransacaoPontos[]);
      setLoading(false);
    });
    return unsub;
  }, [profile?.organizationId]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  // Compute stats for today
  const stats = useMemo(() => {
    const today = getToday();
    const todayTransactions = transacoes.filter(t => {
      const txDate = t.createdAt?.toDate?.();
      if (!txDate) return false;
      return txDate.toDateString() === today.toDateString();
    });

    const pontosVendidos = todayTransactions.reduce((s, t) => s + (t.pontos || 0), 0);
    const receitaTotal = todayTransactions.reduce((s, t) => s + (t.valor || 0), 0);

    return { pontosVendidos, receitaTotal, count: todayTransactions.length };
  }, [transacoes]);

  const filtered = useMemo(() => {
    return transacoes.filter(t => {
      const matchSearch = !search ||
        (t.userName || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.userEmail || '').toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    }).slice(0, 20);
  }, [transacoes, search]);

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0 }}
            className={cn(
              'fixed bottom-8 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl font-semibold flex items-center gap-3',
              toast.ok ? 'bg-zinc-900 text-white' : 'bg-red-600 text-white'
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-amber-50 p-4">
          <p className="text-xs text-stone-500 mb-1">Pontos Vendidos Hoje</p>
          <p className="text-2xl font-black text-amber-700">{stats.pontosVendidos.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-stone-500 mt-1">{stats.count} transações</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-emerald-50 p-4">
          <p className="text-xs text-stone-500 mb-1">Receita Hoje</p>
          <p className="text-2xl font-black text-emerald-700">{fmtBRL(stats.receitaTotal)}</p>
          <p className="text-xs text-stone-500 mt-1">em pontos</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-blue-50 p-4">
          <p className="text-xs text-stone-500 mb-1">Total de Transações</p>
          <p className="text-2xl font-black text-blue-700">{transacoes.length.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-stone-500 mt-1">histórico</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar usuário ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-stone-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-200">
                  <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Usuário</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Quantidade</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Valor</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Data</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-zinc-900">{t.userName || '—'}</div>
                      <div className="text-xs text-zinc-400">{t.userEmail || '—'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-zinc-900 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                        {t.pontos.toLocaleString('pt-BR')} pts
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-emerald-700 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        {fmtBRL(t.valor || 0)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-500">
                      {fmtDate(t.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        Concluída
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-zinc-400 text-sm">
                      {loading ? '' : 'Nenhuma transação encontrada.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
