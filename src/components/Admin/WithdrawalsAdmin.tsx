import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, runTransaction, serverTimestamp, getDoc, addDoc,
  Timestamp, where
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, XCircle, Loader2, AlertCircle, Filter,
  DollarSign, Clock, Search, ChevronDown, BadgeCheck,
  ReceiptText, X, Ban
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WithdrawRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  requested_points: number;
  requested_brl: number;
  conversion_rate_used: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  pix_key: string;
  pix_key_type: string;
  created_at: Timestamp;
  approved_at?: Timestamp;
  paid_at?: Timestamp;
  rejected_at?: Timestamp;
  admin_id?: string;
  admin_note?: string;
  organizationId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', paid: 'Pago', rejected: 'Recusado',
};
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};
const PIX_LABELS: Record<string, string> = {
  cpf: 'CPF', email: 'E-mail', telefone: 'Telefone', aleatoria: 'Aleatória',
};

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(ts?: Timestamp) {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WithdrawalsAdmin() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ req: WithdrawRequest } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!profile?.organizationId) return;
    const q = query(
      collection(db, 'withdraw_requests'),
      where('organizationId', '==', profile.organizationId),
      orderBy('created_at', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })) as WithdrawRequest[]);
      setLoading(false);
    });
    return unsub;
  }, [profile?.organizationId]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const filtered = useMemo(() => requests.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = !search ||
      r.user_name.toLowerCase().includes(search.toLowerCase()) ||
      r.user_email.toLowerCase().includes(search.toLowerCase()) ||
      r.pix_key.includes(search);
    return matchStatus && matchSearch;
  }), [requests, statusFilter, search]);

  // Totals
  const totalPending = requests.filter(r => r.status === 'pending').reduce((s, r) => s + r.requested_brl, 0);
  const totalPaid = requests.filter(r => r.status === 'paid').reduce((s, r) => s + r.requested_brl, 0);

  const handleApprove = async (req: WithdrawRequest) => {
    setActionLoading(req.id);
    try {
      await updateDoc(doc(db, 'withdraw_requests', req.id), {
        status: 'approved',
        approved_at: serverTimestamp(),
        admin_id: profile?.uid,
      });
      // Transaction record
      await addDoc(collection(db, 'transactions'), {
        user_id: req.user_id,
        type: 'withdraw_approved',
        points: req.requested_points,
        brl_value: req.requested_brl,
        status: 'approved',
        reference_id: req.id,
        created_at: serverTimestamp(),
        organizationId: req.organizationId,
      });
      setToast({ ok: true, msg: 'Saque aprovado.' });
    } catch {
      setToast({ ok: false, msg: 'Erro ao aprovar.' });
    } finally { setActionLoading(null); }
  };

  const handleMarkPaid = async (req: WithdrawRequest) => {
    setActionLoading(req.id);
    try {
      await runTransaction(db, async (t) => {
        const userRef = doc(db, 'usuarios', req.user_id);
        const userSnap = await t.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found');
        const userData = userSnap.data();
        const reserved = userData.reserved_points || 0;
        const withdrawn = userData.withdrawn_points || 0;
        t.update(userRef, {
          reserved_points: Math.max(0, reserved - req.requested_points),
          withdrawn_points: withdrawn + req.requested_points,
          updatedAt: serverTimestamp(),
        });
        t.update(doc(db, 'withdraw_requests', req.id), {
          status: 'paid',
          paid_at: serverTimestamp(),
          admin_id: profile?.uid,
        });
      });
      await addDoc(collection(db, 'transactions'), {
        user_id: req.user_id,
        type: 'withdraw_paid',
        points: req.requested_points,
        brl_value: req.requested_brl,
        status: 'paid',
        reference_id: req.id,
        created_at: serverTimestamp(),
        organizationId: req.organizationId,
      });
      setToast({ ok: true, msg: 'Saque marcado como pago.' });
    } catch {
      setToast({ ok: false, msg: 'Erro ao marcar como pago.' });
    } finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectNote.trim()) return;
    const req = rejectModal.req;
    setActionLoading(req.id);
    try {
      await runTransaction(db, async (t) => {
        const userRef = doc(db, 'usuarios', req.user_id);
        const userSnap = await t.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found');
        const userData = userSnap.data();
        const available = userData.pontos || 0;
        const reserved = userData.reserved_points || 0;
        // Return points to available
        t.update(userRef, {
          pontos: available + req.requested_points,
          reserved_points: Math.max(0, reserved - req.requested_points),
          updatedAt: serverTimestamp(),
        });
        t.update(doc(db, 'withdraw_requests', req.id), {
          status: 'rejected',
          rejected_at: serverTimestamp(),
          admin_id: profile?.uid,
          admin_note: rejectNote.trim(),
        });
      });
      await addDoc(collection(db, 'transactions'), {
        user_id: req.user_id,
        type: 'withdraw_rejected',
        points: req.requested_points,
        brl_value: req.requested_brl,
        status: 'rejected',
        reference_id: req.id,
        admin_note: rejectNote.trim(),
        created_at: serverTimestamp(),
        organizationId: req.organizationId,
      });
      setToast({ ok: true, msg: 'Saque recusado. Pontos devolvidos ao usuário.' });
      setRejectModal(null);
      setRejectNote('');
    } catch {
      setToast({ ok: false, msg: 'Erro ao recusar saque.' });
    } finally { setActionLoading(null); }
  };

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
            {toast.ok ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject modal */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-zinc-900">Recusar Solicitação</h3>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                Os pontos de <strong>{rejectModal.req.requested_points.toLocaleString('pt-BR')}</strong> pts serão devolvidos ao saldo do usuário.
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                  Motivo do recuse <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:ring-2 focus:ring-red-400/20 focus:border-red-400 outline-none resize-none"
                  placeholder="Explique o motivo para o usuário..."
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setRejectModal(null); setRejectNote(''); }}
                  className="flex-1 py-2.5 text-sm font-semibold border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors text-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectNote.trim() || !!actionLoading}
                  className="flex-1 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Recuse'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pendentes', value: requests.filter(r => r.status === 'pending').length, sub: fmtBRL(totalPending), color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Aprovados', value: requests.filter(r => r.status === 'approved').length, sub: fmtBRL(requests.filter(r=>r.status==='approved').reduce((s,r)=>s+r.requested_brl,0)), color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Pagos', value: requests.filter(r => r.status === 'paid').length, sub: fmtBRL(totalPaid), color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Recusados', value: requests.filter(r => r.status === 'rejected').length, sub: '—', color: 'text-zinc-600', bg: 'bg-stone-100' },
        ].map(c => (
          <div key={c.label} className={cn('rounded-2xl border border-stone-200 p-4', c.bg)}>
            <p className="text-xs text-stone-500 mb-1">{c.label}</p>
            <p className={cn('text-2xl font-black', c.color)}>{c.value}</p>
            <p className="text-xs text-stone-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['pending', 'approved', 'paid', 'rejected', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                statusFilter === s
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-stone-200 hover:border-zinc-400'
              )}
            >
              {s === 'all' ? 'Todos' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar usuário ou Pix..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-stone-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-500 w-64"
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
                  <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pontos / Valor</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Chave Pix</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Data</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map(req => (
                  <tr key={req.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-zinc-900">{req.user_name}</div>
                      <div className="text-xs text-zinc-400">{req.user_email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-zinc-900">{req.requested_points.toLocaleString('pt-BR')} pts</div>
                      <div className="text-xs text-green-700 font-semibold">{fmtBRL(req.requested_brl)}</div>
                      <div className="text-[10px] text-zinc-400">taxa: {req.conversion_rate_used} pts/R$1</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-zinc-800 font-mono text-xs">{req.pix_key}</div>
                      <div className="text-[10px] text-zinc-400">{PIX_LABELS[req.pix_key_type] || req.pix_key_type}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border', STATUS_STYLE[req.status])}>
                        {STATUS_LABEL[req.status]}
                      </span>
                      {req.admin_note && (
                        <div className="text-[10px] text-zinc-400 mt-1 max-w-[140px] truncate" title={req.admin_note}>
                          {req.admin_note}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-500">
                      <div>{fmtDate(req.created_at)}</div>
                      {req.paid_at && <div className="text-green-600">Pago: {fmtDate(req.paid_at)}</div>}
                      {req.rejected_at && <div className="text-red-500">Recusado: {fmtDate(req.rejected_at)}</div>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={!!actionLoading}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Aprovar
                            </button>
                            <button
                              onClick={() => setRejectModal({ req })}
                              disabled={!!actionLoading}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              <Ban className="w-3 h-3" />
                              Recusar
                            </button>
                          </>
                        )}
                        {req.status === 'approved' && (
                          <button
                            onClick={() => handleMarkPaid(req)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BadgeCheck className="w-3 h-3" />}
                            Marcar Pago
                          </button>
                        )}
                        {(req.status === 'paid' || req.status === 'rejected') && (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-400 text-sm">
                      {loading ? '' : `Nenhuma solicitação ${statusFilter !== 'all' ? STATUS_LABEL[statusFilter]?.toLowerCase() : ''} encontrada.`}
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
