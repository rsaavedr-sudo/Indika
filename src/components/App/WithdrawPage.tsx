import React, { useState, useEffect } from 'react';
import {
  doc, getDoc, collection, query, where, orderBy,
  onSnapshot, runTransaction, addDoc, serverTimestamp, limit, Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, AlertCircle, CheckCircle2, DollarSign, Coins,
  Clock, ArrowRight, Info, KeyRound, XCircle, BadgeCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinanceConfig {
  points_to_brl_rate: number;
  minimum_withdraw_brl: number;
}

interface WithdrawRequest {
  id: string;
  requested_points: number;
  requested_brl: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  pix_key: string;
  pix_key_type: string;
  created_at: Timestamp;
  admin_note?: string;
}

const PIX_TYPES = [
  { value: 'cpf',       label: 'CPF' },
  { value: 'email',     label: 'E-mail' },
  { value: 'telefone',  label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
];

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  paid:     'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', paid: 'Pago', rejected: 'Recusado',
};

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(ts?: Timestamp) {
  if (!ts) return '';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WithdrawPage() {
  const { user, profile } = useAuth();

  const [config, setConfig] = useState<FinanceConfig>({ points_to_brl_rate: 100, minimum_withdraw_brl: 10 });
  const [myRequests, setMyRequests] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // Form
  const [pointsInput, setPointsInput] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('cpf');
  const [savePixKey, setSavePixKey] = useState(true);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  // Load finance config
  useEffect(() => {
    getDoc(doc(db, 'config', 'finance')).then(snap => {
      if (snap.exists()) setConfig(snap.data() as FinanceConfig);
    });
  }, []);

  // Pre-fill Pix key from user profile
  useEffect(() => {
    const loadPixKey = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, 'usuarios', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.pix_key) { setPixKey(data.pix_key); setPixKeyType(data.pix_key_type || 'cpf'); }
      }
    };
    loadPixKey();
  }, [user]);

  // Live list of my withdraw requests
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'withdraw_requests'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      setMyRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })) as WithdrawRequest[]);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // Derived values
  const availablePoints = profile?.pontos ?? 0;
  const reservedPoints  = (profile as any)?.reserved_points ?? 0;
  const { points_to_brl_rate: rate, minimum_withdraw_brl: minBrl } = config;

  const requestedPoints = parseInt(pointsInput) || 0;
  const equivalentBrl   = requestedPoints > 0 ? requestedPoints / rate : 0;
  const minPoints       = minBrl * rate;
  const hasPendingRequest = myRequests.some(r => r.status === 'pending');

  const validationError = (() => {
    if (!pointsInput) return null;
    if (requestedPoints < minPoints)
      return `Mínimo de ${minPoints.toLocaleString('pt-BR')} pts (${fmtBRL(minBrl)})`;
    if (requestedPoints > availablePoints)
      return `Saldo insuficiente. Você tem ${availablePoints.toLocaleString('pt-BR')} pts disponíveis.`;
    if (!pixKey.trim())
      return 'Informe sua chave Pix.';
    return null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError || hasPendingRequest || !user || !profile) return;
    setSubmitting(true);
    try {
      await runTransaction(db, async (t) => {
        const userRef = doc(db, 'usuarios', user.uid);
        const userSnap = await t.get(userRef);
        if (!userSnap.exists()) throw new Error('Usuário não encontrado.');
        const ud = userSnap.data();
        const available = ud.pontos || 0;
        const reserved  = ud.reserved_points || 0;

        if (requestedPoints > available) throw new Error('Saldo insuficiente.');

        // Snapshot config for this request
        const configSnap = await t.get(doc(db, 'config', 'finance'));
        const liveRate = configSnap.exists() ? configSnap.data().points_to_brl_rate : rate;
        const brlValue = requestedPoints / liveRate;

        // Move points to reserved
        t.update(userRef, {
          pontos: available - requestedPoints,
          reserved_points: reserved + requestedPoints,
          ...(savePixKey ? { pix_key: pixKey.trim(), pix_key_type: pixKeyType } : {}),
          updatedAt: serverTimestamp(),
        });

        // Create withdraw request
        const reqRef = doc(collection(db, 'withdraw_requests'));
        t.set(reqRef, {
          user_id: user.uid,
          user_name: `${profile.nome} ${profile.sobrenome}`,
          user_email: profile.email,
          requested_points: requestedPoints,
          requested_brl: brlValue,
          conversion_rate_used: liveRate,
          status: 'pending',
          pix_key: pixKey.trim(),
          pix_key_type: pixKeyType,
          created_at: serverTimestamp(),
          organizationId: profile.organizationId || 'default-org',
        });

        // Transaction record
        const txRef = doc(collection(db, 'transactions'));
        t.set(txRef, {
          user_id: user.uid,
          type: 'withdraw_request',
          points: requestedPoints,
          brl_value: brlValue,
          status: 'pending',
          reference_id: reqRef.id,
          balance_before: available,
          balance_after: available - requestedPoints,
          created_at: serverTimestamp(),
          organizationId: profile.organizationId || 'default-org',
        });
      });

      setToast({ ok: true, msg: 'Solicitação enviada! O admin revisará em breve.' });
      setPointsInput('');
    } catch (err: any) {
      setToast({ ok: false, msg: err.message || 'Erro ao enviar solicitação.' });
    } finally {
      setSubmitting(false);
    }
  };

  const setMax = () => setPointsInput(String(availablePoints));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              'px-4 py-3 rounded-xl border flex items-center gap-2 text-sm font-medium',
              toast.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
            )}
          >
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balance summary */}
      <div className="bg-zinc-950 rounded-2xl p-6 text-white">
        <p className="text-zinc-400 text-sm mb-1">Saldo disponível</p>
        <div className="flex items-end gap-3">
          <span className="text-5xl font-black text-amber-400">{availablePoints.toLocaleString('pt-BR')}</span>
          <span className="text-zinc-400 text-lg mb-1">pts</span>
        </div>
        <p className="text-zinc-400 text-sm mt-1">
          = <span className="text-white font-semibold">{fmtBRL(availablePoints / rate)}</span>
        </p>
        {reservedPoints > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2 text-xs text-amber-300">
            <Clock className="w-3.5 h-3.5" />
            <span>{reservedPoints.toLocaleString('pt-BR')} pts reservados em solicitações pendentes</span>
          </div>
        )}
      </div>

      {/* Active pending alert */}
      {hasPendingRequest && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Você já tem uma solicitação pendente</p>
            <p className="text-xs text-amber-700 mt-0.5">Aguarde a aprovação antes de fazer uma nova solicitação.</p>
          </div>
        </div>
      )}

      {/* Request form */}
      {!hasPendingRequest && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
          <h3 className="font-bold text-zinc-900">Nova solicitação de saque</h3>

          {/* Points amount */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Quantidade de pontos
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={minPoints}
                max={availablePoints}
                step={1}
                required
                value={pointsInput}
                onChange={e => setPointsInput(e.target.value)}
                placeholder={`Mínimo: ${minPoints.toLocaleString('pt-BR')} pts`}
                className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 outline-none text-sm font-mono"
              />
              <button type="button" onClick={setMax}
                className="px-4 py-2.5 text-xs font-semibold border border-stone-200 rounded-xl hover:bg-stone-50 text-zinc-600 transition-colors whitespace-nowrap">
                Máximo
              </button>
            </div>
            {requestedPoints > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-bold text-green-700">{fmtBRL(equivalentBrl)}</span>
                <span className="text-xs text-zinc-400">(taxa: {rate} pts = R$1)</span>
              </div>
            )}
            {validationError && pointsInput && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{validationError}
              </p>
            )}
          </div>

          {/* Pix key */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Chave Pix para receber
            </label>
            <div className="flex gap-2">
              <select
                value={pixKeyType}
                onChange={e => setPixKeyType(e.target.value)}
                className="w-40 px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 outline-none"
              >
                {PIX_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <input
                type="text"
                required
                value={pixKey}
                onChange={e => setPixKey(e.target.value)}
                placeholder={
                  pixKeyType === 'cpf' ? '000.000.000-00' :
                  pixKeyType === 'email' ? 'seu@email.com' :
                  pixKeyType === 'telefone' ? '+55 11 99999-9999' :
                  'Chave aleatória'
                }
                className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 outline-none text-sm"
              />
            </div>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={savePixKey} onChange={e => setSavePixKey(e.target.checked)}
                className="rounded border-stone-300 text-amber-500 focus:ring-amber-400" />
              <span className="text-xs text-stone-500">Salvar esta chave para futuros saques</span>
            </label>
          </div>

          {/* Info box */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 flex items-start gap-2 text-xs text-stone-600">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
            <span>
              Após o envio, seus pontos ficam reservados e a solicitação é revisada pelo administrador.
              Você receberá o Pix após aprovação e processamento.
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting || !!validationError || !pointsInput || !pixKey}
            className="w-full bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-300 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            Solicitar Saque via Pix
          </button>
        </form>
      )}

      {/* My requests history */}
      {myRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h3 className="font-bold text-zinc-900 text-sm">Minhas Solicitações</h3>
          </div>
          <div className="divide-y divide-stone-100">
            {myRequests.map(req => (
              <div key={req.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900">{req.requested_points.toLocaleString('pt-BR')} pts</span>
                    <span className="text-green-700 font-semibold text-sm">{fmtBRL(req.requested_brl)}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Pix {req.pix_key_type}: {req.pix_key} · {fmtDate(req.created_at)}
                  </div>
                  {req.admin_note && req.status === 'rejected' && (
                    <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {req.admin_note}
                    </div>
                  )}
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap', STATUS_STYLE[req.status])}>
                  {STATUS_LABEL[req.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
