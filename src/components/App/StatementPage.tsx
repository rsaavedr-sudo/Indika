import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, limit, Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Loader2, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, Coins, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  user_id: string;
  type: 'earn' | 'withdraw_request' | 'withdraw_paid' | 'withdraw_rejected' | 'withdraw_approved' | 'adjustment';
  points: number;
  brl_value?: number;
  status: string;
  reference_id?: string;
  balance_before?: number;
  balance_after?: number;
  created_at: Timestamp;
  admin_note?: string;
}

interface WithdrawRequest {
  id: string;
  requested_points: number;
  requested_brl: number;
  status: string;
  created_at: Timestamp;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TX_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; sign: string }> = {
  earn: {
    label: 'Pontos ganhos',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'text-green-700 bg-green-50 border-green-200',
    sign: '+',
  },
  withdraw_request: {
    label: 'Saque solicitado',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    sign: '−',
  },
  withdraw_approved: {
    label: 'Saque aprovado',
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    sign: '−',
  },
  withdraw_paid: {
    label: 'Saque pago',
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-green-700 bg-green-50 border-green-200',
    sign: '−',
  },
  withdraw_rejected: {
    label: 'Saque recusado',
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-zinc-600 bg-stone-100 border-stone-200',
    sign: '+',
  },
  adjustment: {
    label: 'Ajuste manual',
    icon: <RefreshCw className="w-4 h-4" />,
    color: 'text-violet-700 bg-violet-50 border-violet-200',
    sign: '',
  },
};

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(ts?: Timestamp) {
  if (!ts) return '';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StatementPage() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const qTx = query(
      collection(db, 'transactions'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc'),
      limit(50)
    );
    const unsubTx = onSnapshot(qTx, snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[]);
      setLoading(false);
    });

    const qWr = query(
      collection(db, 'withdraw_requests'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc')
    );
    const unsubWr = onSnapshot(qWr, snap => {
      setWithdrawRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })) as WithdrawRequest[]);
    });

    return () => { unsubTx(); unsubWr(); };
  }, [user]);

  // Summary stats
  const stats = useMemo(() => {
    const availablePoints = profile?.pontos ?? 0;
    const reservedPoints  = (profile as any)?.reserved_points ?? 0;
    const withdrawnPoints = (profile as any)?.withdrawn_points ?? 0;

    const totalPaid = withdrawRequests
      .filter(r => r.status === 'paid')
      .reduce((s, r) => s + r.requested_brl, 0);

    const pendingPix = withdrawRequests
      .filter(r => r.status === 'pending' || r.status === 'approved')
      .reduce((s, r) => s + r.requested_brl, 0);

    return { availablePoints, reservedPoints, withdrawnPoints, totalPaid, pendingPix };
  }, [profile, withdrawRequests]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Available */}
        <div className="col-span-2 bg-zinc-950 rounded-2xl p-5 text-white">
          <p className="text-zinc-400 text-xs mb-1">Saldo disponível</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-amber-400">
              {stats.availablePoints.toLocaleString('pt-BR')}
            </span>
            <span className="text-zinc-400 mb-1">pts</span>
          </div>
          {stats.reservedPoints > 0 && (
            <p className="text-xs text-zinc-500 mt-1">
              + {stats.reservedPoints.toLocaleString('pt-BR')} pts reservados em saques pendentes
            </p>
          )}
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Total saques pagos</span>
          </div>
          <p className="text-xl font-black text-zinc-900">{fmtBRL(stats.totalPaid)}</p>
          <p className="text-xs text-stone-400 mt-1">{stats.withdrawnPoints.toLocaleString('pt-BR')} pts resgatados</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Pix pendente</span>
          </div>
          <p className="text-xl font-black text-zinc-900">{fmtBRL(stats.pendingPix)}</p>
          <p className="text-xs text-stone-400 mt-1">
            {withdrawRequests.filter(r => r.status === 'pending' || r.status === 'approved').length} solicitação(ões)
          </p>
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900 text-sm">Movimentos</h3>
          <span className="text-xs text-zinc-400">{transactions.length} registros</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 text-sm">Nenhum movimento registrado ainda.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {transactions.map(tx => {
              const cfg = TX_CONFIG[tx.type] || TX_CONFIG['adjustment'];
              const isDebit = tx.type === 'withdraw_request' || tx.type === 'withdraw_paid' || tx.type === 'withdraw_approved';
              return (
                <div key={tx.id} className="px-5 py-4 flex items-center gap-4">
                  <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0', cfg.color)}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-800">{cfg.label}</div>
                    <div className="text-xs text-zinc-400">{fmtDate(tx.created_at)}</div>
                    {tx.admin_note && (
                      <div className="text-xs text-zinc-500 mt-0.5 truncate">{tx.admin_note}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cn('text-sm font-bold tabular-nums',
                      tx.type === 'withdraw_rejected' ? 'text-green-700' :
                      isDebit ? 'text-red-600' : 'text-green-700'
                    )}>
                      {tx.type === 'withdraw_rejected' ? '+' : isDebit ? '−' : '+'}
                      {tx.points.toLocaleString('pt-BR')} pts
                    </div>
                    {tx.brl_value !== undefined && tx.brl_value > 0 && (
                      <div className="text-xs text-zinc-400">{fmtBRL(tx.brl_value)}</div>
                    )}
                    {tx.balance_after !== undefined && (
                      <div className="text-[10px] text-zinc-300">saldo: {tx.balance_after.toLocaleString('pt-BR')}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
