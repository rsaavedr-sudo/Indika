import React, { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { ImageUploadField } from './AdminDashboard';
import { DEFAULT_FAIXAS } from '../../utils/faixas';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Pencil, Trash2, Loader2, AlertCircle, CheckCircle2,
  Target, X, XCircle, ToggleLeft, ToggleRight, Zap, Users, Calendar,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type MissaoTipo = 'simples' | 'progressiva' | 'viral' | 'engagement';
type MissaoStatus = 'ativa' | 'inativa';

interface Missao {
  id: string;
  nome: string;
  descricao: string;
  imagemUrl?: string;
  tipo: MissaoTipo;
  pontos: number;
  meta: number;
  dataInicio: Timestamp;
  dataFim: Timestamp;
  status: MissaoStatus;
  faixaMinima?: string;
  atribuicao: 'todos' | 'especificos';
  organizationId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<MissaoTipo, string> = {
  simples: 'Simples',
  progressiva: 'Progressiva',
  viral: 'Viral',
  engagement: 'Engagement',
};

const TIPO_DESCRIPTIONS: Record<MissaoTipo, string> = {
  simples: 'Ação única — o usuário completa uma tarefa e ganha os pontos',
  progressiva: 'Meta de X ações — pontos ao atingir a meta total',
  viral: 'Convide outros usuários — recompensa por indicações',
  engagement: 'Uso recorrente — pontos por atividade regular',
};

const TIPO_COLORS: Record<MissaoTipo, string> = {
  simples: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  progressiva: 'bg-blue-50 text-blue-700 border-blue-200',
  viral: 'bg-violet-50 text-violet-700 border-violet-200',
  engagement: 'bg-amber-50 text-amber-700 border-amber-200',
};

const emptyForm = () => ({
  nome: '',
  descricao: '',
  imagemUrl: '',
  tipo: 'simples' as MissaoTipo,
  pontos: 100,
  meta: 1,
  dataInicio: new Date().toISOString().split('T')[0],
  dataFim: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  status: 'ativa' as MissaoStatus,
  faixaMinima: '',
  atribuicao: 'todos' as 'todos' | 'especificos',
  organizationId: 'default-org',
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MissoesAdmin() {
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ativa' | 'inativa'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editMissao, setEditMissao] = useState<Missao | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'missoes'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setMissoes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Missao[]);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta missão? Esta ação não pode ser desfeita.')) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'missoes', id));
      setToast({ msg: 'Missão excluída.', ok: true });
    } catch {
      setToast({ msg: 'Erro ao excluir.', ok: false });
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleStatus = async (m: Missao) => {
    try {
      await updateDoc(doc(db, 'missoes', m.id), {
        status: m.status === 'ativa' ? 'inativa' : 'ativa',
        updatedAt: serverTimestamp(),
      });
    } catch {
      setToast({ msg: 'Erro ao atualizar status.', ok: false });
    }
  };

  const filtered = missoes.filter(m => {
    const matchSearch = m.nome.toLowerCase().includes(search.toLowerCase()) ||
      m.descricao.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-black text-slate-900">Missões</h2>
          <p className="text-sm text-slate-500">
            {missoes.filter(m => m.status === 'ativa').length} ativas · {missoes.length} total
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow text-sm transition-all"
        >
          <Plus className="w-4 h-4" /> Nova Missão
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium',
              toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            )}
          >
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar missões..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
        />
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {(['all', 'ativa', 'inativa'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                filterStatus === s ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {s === 'all' ? 'Todas' : s === 'ativa' ? 'Ativas' : 'Inativas'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
          <Target className="w-12 h-12 opacity-30" />
          <p className="font-medium">{search ? 'Nenhuma missão encontrada.' : 'Crie sua primeira missão!'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(m => (
            <MissaoCard
              key={m.id}
              missao={m}
              onEdit={() => setEditMissao(m)}
              onDelete={() => handleDelete(m.id)}
              onToggle={() => handleToggleStatus(m)}
              deleting={deleting === m.id}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <MissaoModal
            mode="create"
            onClose={() => setIsCreateOpen(false)}
            onSuccess={() => { setToast({ msg: 'Missão criada!', ok: true }); setIsCreateOpen(false); }}
            onError={msg => setToast({ msg, ok: false })}
          />
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editMissao && (
          <MissaoModal
            mode="edit"
            missao={editMissao}
            onClose={() => setEditMissao(null)}
            onSuccess={() => { setToast({ msg: 'Missão atualizada!', ok: true }); setEditMissao(null); }}
            onError={msg => setToast({ msg, ok: false })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Missão Card ──────────────────────────────────────────────────────────────

function MissaoCard({
  missao: m,
  onEdit, onDelete, onToggle, deleting,
}: {
  key?: React.Key;
  missao: Missao;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  deleting: boolean;
}) {
  return (
    <div className={cn(
      'bg-white rounded-2xl border overflow-hidden transition-all',
      m.status === 'ativa' ? 'border-slate-200 shadow-sm' : 'border-slate-200 opacity-60'
    )}>
      {/* Image */}
      {m.imagemUrl ? (
        <div className="w-full h-28 overflow-hidden">
          <img src={m.imagemUrl} alt={m.nome} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-20 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
          <Target className="w-8 h-8 text-blue-300" />
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Type + status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', TIPO_COLORS[m.tipo])}>
            {TIPO_LABELS[m.tipo]}
          </span>
          {m.faixaMinima && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {DEFAULT_FAIXAS.find(f => f.id === m.faixaMinima)?.emoji} {DEFAULT_FAIXAS.find(f => f.id === m.faixaMinima)?.nome}
            </span>
          )}
        </div>

        {/* Name */}
        <div>
          <h3 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">{m.nome}</h3>
          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{m.descricao}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1 font-black text-amber-600">
            <Zap className="w-3.5 h-3.5" />+{m.pontos} pts
          </span>
          {m.meta > 1 && (
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />Meta: {m.meta}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {m.dataFim?.toDate?.().toLocaleDateString('pt-BR') || '—'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <button
            onClick={onToggle}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold transition-colors',
              m.status === 'ativa' ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            {m.status === 'ativa'
              ? <><ToggleRight className="w-4 h-4" />Ativa</>
              : <><ToggleLeft className="w-4 h-4" />Inativa</>}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function MissaoModal({
  mode, missao, onClose, onSuccess, onError,
}: {
  mode: 'create' | 'edit';
  missao?: Missao;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState(() => ({
    nome: missao?.nome ?? '',
    descricao: missao?.descricao ?? '',
    imagemUrl: missao?.imagemUrl ?? '',
    tipo: missao?.tipo ?? 'simples' as MissaoTipo,
    pontos: missao?.pontos ?? 100,
    meta: missao?.meta ?? 1,
    dataInicio: missao?.dataInicio?.toDate?.().toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
    dataFim: missao?.dataFim?.toDate?.().toISOString().split('T')[0] ?? new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    status: missao?.status ?? 'ativa' as MissaoStatus,
    faixaMinima: missao?.faixaMinima ?? '',
    atribuicao: missao?.atribuicao ?? 'todos' as 'todos' | 'especificos',
    organizationId: missao?.organizationId ?? 'default-org',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: unknown) => setForm(p => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) { setError('Nome é obrigatório.'); return; }
    if (form.pontos <= 0) { setError('Pontos devem ser maiores que 0.'); return; }
    if (form.meta < 1) { setError('Meta deve ser no mínimo 1.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        imagemUrl: form.imagemUrl || null,
        tipo: form.tipo,
        pontos: Number(form.pontos),
        meta: form.tipo === 'simples' ? 1 : Number(form.meta),
        dataInicio: Timestamp.fromDate(new Date(form.dataInicio)),
        dataFim: Timestamp.fromDate(new Date(form.dataFim)),
        status: form.status,
        faixaMinima: form.faixaMinima || null,
        atribuicao: form.atribuicao,
        organizationId: form.organizationId,
        updatedAt: serverTimestamp(),
      };

      if (mode === 'create') {
        await addDoc(collection(db, 'missoes'), { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'missoes', missao!.id), payload);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      onError('Erro ao salvar missão. Tente novamente.');
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const inp = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-900">
            {mode === 'create' ? 'Nova Missão' : 'Editar Missão'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="missao-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            {/* Image */}
            <ImageUploadField
              value={form.imagemUrl}
              onChange={v => set('imagemUrl', v)}
              label="Imagem da Missão (opcional)"
            />

            {/* Nome */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome *</label>
              <input className={inp} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Primeira Venda do Mês" required />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Descrição</label>
              <textarea className={cn(inp, 'resize-none')} rows={3} value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Explique o que o usuário precisa fazer..." />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tipo de Missão</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(TIPO_LABELS) as [MissaoTipo, string][]).map(([tipo, label]) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => set('tipo', tipo)}
                    className={cn(
                      'flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all',
                      form.tipo === tipo
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <span className="text-sm font-bold text-slate-800">{label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">{TIPO_DESCRIPTIONS[tipo]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pontos + Meta */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pontos *</label>
                <input className={inp} type="number" min={1} value={form.pontos} onChange={e => set('pontos', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Meta {form.tipo === 'simples' ? '(fixo: 1)' : '(ações necessárias)'}
                </label>
                <input
                  className={cn(inp, form.tipo === 'simples' && 'opacity-50 cursor-not-allowed')}
                  type="number" min={1}
                  value={form.tipo === 'simples' ? 1 : form.meta}
                  disabled={form.tipo === 'simples'}
                  onChange={e => set('meta', e.target.value)}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Início *</label>
                <input className={inp} type="date" value={form.dataInicio} onChange={e => set('dataInicio', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fim *</label>
                <input className={inp} type="date" value={form.dataFim} onChange={e => set('dataFim', e.target.value)} required />
              </div>
            </div>

            {/* Faixa mínima + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Faixa Mínima</label>
                <select className={inp} value={form.faixaMinima} onChange={e => set('faixaMinima', e.target.value)}>
                  <option value="">Sem restrição</option>
                  {DEFAULT_FAIXAS.map(f => (
                    <option key={f.id} value={f.id}>{f.emoji} {f.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="ativa">✅ Ativa</option>
                  <option value="inativa">⏸️ Inativa</option>
                </select>
              </div>
            </div>

            {/* Atribuição */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Atribuição</label>
              <div className="flex gap-3">
                {([['todos', <><Users className="w-4 h-4" /> Todos os usuários</>], ['especificos', <><Users className="w-4 h-4" /> Usuários específicos</>]] as const).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => set('atribuicao', val)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                      form.atribuicao === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    )}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            form="missao-form"
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {mode === 'create' ? 'Criar Missão' : 'Salvar Alterações'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
