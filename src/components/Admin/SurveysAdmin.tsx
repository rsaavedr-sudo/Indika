import React, { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, orderBy, Timestamp, getDocs, where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Pencil, Trash2, Loader2, AlertCircle, CheckCircle2,
  ClipboardList, X, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  GripVertical, Check, Type, AlignLeft, ListChecks, ToggleRight as Toggle2,
  FileQuestion, Star, Search, Filter, Users, Award,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type SurveyTipo = 'premiada' | 'perfilamento' | 'engagement' | 'patrocinada';
type SurveyStatus = 'rascunho' | 'ativa' | 'pausada' | 'arquivada';
type QuestionTipo = 'unica' | 'multipla' | 'texto' | 'sino';

interface SurveyQuestion {
  id?: string;
  ordem: number;
  tipo: QuestionTipo;
  texto: string;
  opcoes: string[];
  obrigatorio: boolean;
}

interface Survey {
  id: string;
  titulo: string;
  descricao: string;
  tipo: SurveyTipo;
  status: SurveyStatus;
  pontos: number;
  estimatedMinutes: number;
  missionId?: string;
  organizationId: string;
  totalRespostas: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Missao {
  id: string;
  nome: string;
  status: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<SurveyTipo, string> = {
  premiada: 'Premiada',
  perfilamento: 'Perfilamento',
  engagement: 'Engajamento',
  patrocinada: 'Patrocinada',
};

const TIPO_COLORS: Record<SurveyTipo, string> = {
  premiada:    'bg-amber-50 text-amber-700 border-amber-200',
  perfilamento:'bg-blue-50 text-blue-700 border-blue-200',
  engagement:  'bg-violet-50 text-violet-700 border-violet-200',
  patrocinada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const TIPO_DESCRIPTIONS: Record<SurveyTipo, string> = {
  premiada:     'Pesquisa com recompensa em pontos',
  perfilamento: 'Coleta dados de perfil do usuário',
  engagement:   'Aumenta interação e atividade',
  patrocinada:  'Pesquisa de terceiros com patrocínio',
};

const STATUS_LABELS: Record<SurveyStatus, string> = {
  rascunho:  'Rascunho',
  ativa:     'Ativa',
  pausada:   'Pausada',
  arquivada: 'Arquivada',
};

const STATUS_STYLES: Record<SurveyStatus, string> = {
  rascunho:  'bg-stone-100 text-zinc-500',
  ativa:     'bg-green-50 text-green-700',
  pausada:   'bg-amber-50 text-amber-700',
  arquivada: 'bg-stone-50 text-zinc-400',
};

const QUESTION_TIPO_LABELS: Record<QuestionTipo, string> = {
  unica:    'Opção Única',
  multipla: 'Múltipla Escolha',
  texto:    'Texto Livre',
  sino:     'Sim / Não',
};

const QUESTION_TIPO_ICONS: Record<QuestionTipo, React.ReactNode> = {
  unica:    <Check className="w-3.5 h-3.5" />,
  multipla: <ListChecks className="w-3.5 h-3.5" />,
  texto:    <AlignLeft className="w-3.5 h-3.5" />,
  sino:     <ToggleLeft className="w-3.5 h-3.5" />,
};

// ─── Question Builder ─────────────────────────────────────────────────────────

function QuestionEditor({
  question,
  index,
  onUpdate,
  onRemove,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  question: SurveyQuestion;
  index: number;
  onUpdate: (q: SurveyQuestion) => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [newOpcao, setNewOpcao] = useState('');

  const addOpcao = () => {
    const val = newOpcao.trim();
    if (!val) return;
    onUpdate({ ...question, opcoes: [...question.opcoes, val] });
    setNewOpcao('');
  };

  const removeOpcao = (i: number) => {
    onUpdate({ ...question, opcoes: question.opcoes.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="border border-stone-200 rounded-xl p-4 bg-white">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 mt-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-0.5 rounded text-zinc-300 hover:text-zinc-600 disabled:opacity-30 transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-0.5 rounded text-zinc-300 hover:text-zinc-600 disabled:opacity-30 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-500 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
              {index + 1}
            </span>
            <select
              value={question.tipo}
              onChange={e => onUpdate({ ...question, tipo: e.target.value as QuestionTipo, opcoes: [] })}
              className="text-xs border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 text-zinc-600 outline-none focus:border-indigo-400"
            >
              {(Object.keys(QUESTION_TIPO_LABELS) as QuestionTipo[]).map(t => (
                <option key={t} value={t}>{QUESTION_TIPO_LABELS[t]}</option>
              ))}
            </select>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
              <input
                type="checkbox"
                checked={question.obrigatorio}
                onChange={e => onUpdate({ ...question, obrigatorio: e.target.checked })}
                className="w-3 h-3 rounded accent-indigo-600"
              />
              Obrigatória
            </label>
            <button
              type="button"
              onClick={onRemove}
              className="p-1 text-zinc-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Question text */}
          <input
            type="text"
            value={question.texto}
            onChange={e => onUpdate({ ...question, texto: e.target.value })}
            placeholder={`Pergunta ${index + 1}...`}
            className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 bg-stone-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
          />

          {/* Options for single/multiple */}
          {(question.tipo === 'unica' || question.tipo === 'multipla') && (
            <div className="space-y-2">
              {question.opcoes.map((op, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn(
                    'w-3.5 h-3.5 border-2 border-stone-300 flex-shrink-0',
                    question.tipo === 'unica' ? 'rounded-full' : 'rounded'
                  )} />
                  <span className="flex-1 text-sm text-zinc-700">{op}</span>
                  <button
                    type="button"
                    onClick={() => removeOpcao(i)}
                    className="p-0.5 text-zinc-300 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-3.5 h-3.5 border-2 border-dashed border-stone-300 flex-shrink-0',
                  question.tipo === 'unica' ? 'rounded-full' : 'rounded'
                )} />
                <input
                  type="text"
                  value={newOpcao}
                  onChange={e => setNewOpcao(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOpcao(); } }}
                  placeholder="Adicionar opção..."
                  className="flex-1 text-sm border-0 border-b border-dashed border-stone-300 pb-0.5 bg-transparent focus:outline-none focus:border-indigo-400 text-zinc-600"
                />
                <button
                  type="button"
                  onClick={addOpcao}
                  className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors font-medium"
                >
                  + Add
                </button>
              </div>
            </div>
          )}

          {question.tipo === 'texto' && (
            <div className="h-8 border border-dashed border-stone-200 rounded-lg bg-stone-50 flex items-center px-3">
              <span className="text-xs text-zinc-400 italic">Campo de texto livre</span>
            </div>
          )}

          {question.tipo === 'sino' && (
            <div className="flex items-center gap-3">
              {['Sim', 'Não'].map(op => (
                <div key={op} className="flex items-center gap-1.5 text-sm text-zinc-500">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-stone-300" />
                  {op}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Survey Modal ─────────────────────────────────────────────────────────────

function SurveyModal({
  survey,
  missoes,
  onClose,
  onSaved,
  organizationId,
}: {
  survey: Survey | null;
  missoes: Missao[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  organizationId: string;
}) {
  const isEdit = !!survey;

  const [titulo, setTitulo] = useState(survey?.titulo ?? '');
  const [descricao, setDescricao] = useState(survey?.descricao ?? '');
  const [tipo, setTipo] = useState<SurveyTipo>(survey?.tipo ?? 'premiada');
  const [status, setStatus] = useState<SurveyStatus>(survey?.status ?? 'rascunho');
  const [pontos, setPontos] = useState(survey?.pontos ?? 50);
  const [estimatedMinutes, setEstimatedMinutes] = useState(survey?.estimatedMinutes ?? 5);
  const [missionId, setMissionId] = useState(survey?.missionId ?? '');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'questions'>('info');

  // Load existing questions when editing
  useEffect(() => {
    if (!survey) return;
    setLoadingQuestions(true);
    const q = query(
      collection(db, 'survey_questions'),
      where('surveyId', '==', survey.id),
      orderBy('ordem', 'asc')
    );
    getDocs(q).then(snap => {
      const qs: SurveyQuestion[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<SurveyQuestion, 'id'>),
      }));
      setQuestions(qs);
    }).finally(() => setLoadingQuestions(false));
  }, [survey]);

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      ordem: prev.length + 1,
      tipo: 'unica',
      texto: '',
      opcoes: [],
      obrigatorio: true,
    }]);
  };

  const updateQuestion = (i: number, q: SurveyQuestion) => {
    setQuestions(prev => prev.map((x, idx) => idx === i ? q : x));
  };

  const removeQuestion = (i: number) => {
    setQuestions(prev => prev.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, ordem: idx + 1 })));
  };

  const moveQuestion = (i: number, direction: 'up' | 'down') => {
    setQuestions(prev => {
      const arr = [...prev];
      const target = direction === 'up' ? i - 1 : i + 1;
      [arr[i], arr[target]] = [arr[target], arr[i]];
      return arr.map((q, idx) => ({ ...q, ordem: idx + 1 }));
    });
  };

  const handleSave = async () => {
    if (!titulo.trim()) { setError('Título obrigatório'); return; }
    if (questions.some(q => !q.texto.trim())) { setError('Preencha o texto de todas as perguntas'); return; }
    if (questions.some(q => (q.tipo === 'unica' || q.tipo === 'multipla') && q.opcoes.length < 2)) {
      setError('Perguntas de opção única/múltipla precisam de pelo menos 2 opções'); return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        tipo,
        status,
        pontos,
        estimatedMinutes,
        missionId: missionId || null,
        organizationId,
        updatedAt: serverTimestamp(),
        totalRespostas: survey?.totalRespostas ?? 0,
      };

      let surveyId = survey?.id;

      if (isEdit && surveyId) {
        await updateDoc(doc(db, 'surveys', surveyId), payload);
      } else {
        const ref = await addDoc(collection(db, 'surveys'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        surveyId = ref.id;
      }

      // Save questions: delete old ones, re-insert
      if (surveyId) {
        // Delete old questions
        const oldQ = await getDocs(query(collection(db, 'survey_questions'), where('surveyId', '==', surveyId)));
        await Promise.all(oldQ.docs.map(d => deleteDoc(d.ref)));

        // Insert new questions
        await Promise.all(questions.map((q, i) =>
          addDoc(collection(db, 'survey_questions'), {
            surveyId,
            ordem: i + 1,
            tipo: q.tipo,
            texto: q.texto.trim(),
            opcoes: q.opcoes,
            obrigatorio: q.obrigatorio,
            organizationId,
          })
        ));
      }

      onSaved(isEdit ? 'Pesquisa atualizada!' : 'Pesquisa criada!');
      onClose();
    } catch (e) {
      console.error(e);
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                {isEdit ? 'Editar Pesquisa' : 'Nova Pesquisa'}
              </h2>
              <p className="text-xs text-zinc-500">
                {questions.length} pergunta{questions.length !== 1 ? 's' : ''} configurada{questions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-stone-100 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100 px-6 gap-4">
          {(['info', 'questions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'text-sm font-medium pb-3 pt-3 border-b-2 transition-all',
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              )}
            >
              {tab === 'info' ? 'Informações' : `Perguntas (${questions.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-5">
              {/* Tipo selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Tipo de Pesquisa</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TIPO_LABELS) as SurveyTipo[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo(t)}
                      className={cn(
                        'text-left px-3 py-2.5 rounded-xl border-2 transition-all',
                        tipo === t ? 'border-indigo-500 bg-indigo-50' : 'border-stone-200 hover:border-stone-300 bg-stone-50'
                      )}
                    >
                      <p className={cn('text-sm font-semibold', tipo === t ? 'text-indigo-700' : 'text-zinc-700')}>{TIPO_LABELS[t]}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{TIPO_DESCRIPTIONS[t]}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Título *</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Pesquisa de satisfação"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Descrição</label>
                <textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  rows={2}
                  placeholder="Breve descrição para o usuário..."
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Pontos + Tempo + Status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Pontos</label>
                  <input
                    type="number"
                    min={0}
                    value={pontos}
                    onChange={e => setPontos(Number(e.target.value))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Tempo (min)</label>
                  <input
                    type="number"
                    min={1}
                    value={estimatedMinutes}
                    onChange={e => setEstimatedMinutes(Number(e.target.value))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as SurveyStatus)}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  >
                    {(Object.keys(STATUS_LABELS) as SurveyStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mission link */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Vincular à Missão (opcional)</label>
                <select
                  value={missionId}
                  onChange={e => setMissionId(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                >
                  <option value="">Sem vínculo com missão</option>
                  {missoes.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
                <p className="text-xs text-zinc-400 mt-1">A pesquisa aparecerá como etapa vinculada à missão selecionada.</p>
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-3">
              {loadingQuestions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : (
                <>
                  {questions.length === 0 && (
                    <div className="text-center py-8 text-zinc-400">
                      <FileQuestion className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhuma pergunta ainda</p>
                      <p className="text-xs mt-1">Clique em "+ Adicionar Pergunta" para começar</p>
                    </div>
                  )}

                  <AnimatePresence mode="popLayout">
                    {questions.map((q, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <QuestionEditor
                          question={q}
                          index={i}
                          onUpdate={updated => updateQuestion(i, updated)}
                          onRemove={() => removeQuestion(i)}
                          canMoveUp={i > 0}
                          canMoveDown={i < questions.length - 1}
                          onMoveUp={() => moveQuestion(i, 'up')}
                          onMoveDown={() => moveQuestion(i, 'down')}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={addQuestion}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-stone-300 rounded-xl text-sm font-medium text-zinc-400 hover:border-indigo-400 hover:text-indigo-500 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Pergunta
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-stone-200 text-sm font-medium text-zinc-600 hover:bg-stone-100 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {activeTab === 'info' && (
              <button
                type="button"
                onClick={() => setActiveTab('questions')}
                className="px-4 py-2 rounded-xl bg-stone-100 text-sm font-medium text-zinc-700 hover:bg-stone-200 transition-all"
              >
                Perguntas →
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar Pesquisa'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SurveysAdmin() {
  const { profile } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Survey | null>(null);
  const [deleting, setDeleting] = useState<Survey | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const orgId = (profile as any)?.organizationId ?? '';

  // Load surveys
  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'surveys'), where('organizationId', '==', orgId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setSurveys(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Survey, 'id'>) })));
      setLoading(false);
    });
    return unsub;
  }, [orgId]);

  // Load missions for linking
  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'missoes'), where('organizationId', '==', orgId), orderBy('createdAt', 'desc'));
    getDocs(q).then(snap => {
      setMissoes(snap.docs.map(d => ({ id: d.id, nome: d.data().nome, status: d.data().status })));
    });
  }, [orgId]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      // Delete questions first
      const qSnap = await getDocs(query(collection(db, 'survey_questions'), where('surveyId', '==', deleting.id)));
      await Promise.all(qSnap.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'surveys', deleting.id));
      setToast({ type: 'success', text: 'Pesquisa excluída.' });
      setDeleting(null);
    } catch {
      setToast({ type: 'error', text: 'Erro ao excluir.' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleStatus = async (s: Survey) => {
    const newStatus: SurveyStatus = s.status === 'ativa' ? 'pausada' : 'ativa';
    await updateDoc(doc(db, 'surveys', s.id), { status: newStatus, updatedAt: serverTimestamp() });
    setToast({ type: 'success', text: `Pesquisa ${newStatus === 'ativa' ? 'ativada' : 'pausada'}.` });
  };

  const filtered = surveys.filter(s => {
    const matchSearch = !search || s.titulo.toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === 'todos' || s.tipo === tipoFilter;
    const matchStatus = statusFilter === 'todos' || s.status === statusFilter;
    return matchSearch && matchTipo && matchStatus;
  });

  // KPIs
  const total = surveys.length;
  const ativas = surveys.filter(s => s.status === 'ativa').length;
  const totalRespostas = surveys.reduce((sum, s) => sum + (s.totalRespostas ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Pesquisas</h1>
            <p className="text-xs text-zinc-500">{total} pesquisa{total !== 1 ? 's' : ''} cadastrada{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nova Pesquisa
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total de Pesquisas', value: total, icon: <ClipboardList className="w-4 h-4" />, color: 'text-zinc-700' },
          { label: 'Pesquisas Ativas', value: ativas, icon: <ToggleRight className="w-4 h-4" />, color: 'text-green-600' },
          { label: 'Respostas Coletadas', value: totalRespostas, icon: <Users className="w-4 h-4" />, color: 'text-indigo-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <span className={kpi.color}>{kpi.icon}</span>
              <span className="text-xs font-medium">{kpi.label}</span>
            </div>
            <p className={cn('text-2xl font-bold', kpi.color)}>{kpi.value.toLocaleString('pt-BR')}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar pesquisa..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
            />
          </div>
          <select
            value={tipoFilter}
            onChange={e => setTipoFilter(e.target.value)}
            className="text-sm border border-stone-200 rounded-xl px-3 py-2 bg-stone-50 focus:outline-none focus:border-indigo-400 text-zinc-600"
          >
            <option value="todos">Todos os tipos</option>
            {(Object.keys(TIPO_LABELS) as SurveyTipo[]).map(t => (
              <option key={t} value={t}>{TIPO_LABELS[t]}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-stone-200 rounded-xl px-3 py-2 bg-stone-50 focus:outline-none focus:border-indigo-400 text-zinc-600"
          >
            <option value="todos">Todos os status</option>
            {(Object.keys(STATUS_LABELS) as SurveyStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <ClipboardList className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma pesquisa encontrada</p>
            <p className="text-xs mt-1">Crie a primeira pesquisa clicando em "Nova Pesquisa"</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pesquisa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pontos</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Respostas</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 leading-tight">{s.titulo}</p>
                    {s.descricao && <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{s.descricao}</p>}
                    <p className="text-xs text-zinc-400 mt-0.5">~{s.estimatedMinutes} min</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', TIPO_COLORS[s.tipo])}>
                      {TIPO_LABELS[s.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-amber-600">{s.pontos.toLocaleString('pt-BR')}</span>
                    <span className="text-xs text-zinc-400 ml-1">pts</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-zinc-700 font-medium">{(s.totalRespostas ?? 0).toLocaleString('pt-BR')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[s.status])}>
                      {STATUS_LABELS[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {(s.status === 'ativa' || s.status === 'pausada') && (
                        <button
                          onClick={() => toggleStatus(s)}
                          className={cn(
                            'p-1.5 rounded-lg transition-all',
                            s.status === 'ativa'
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-zinc-400 hover:bg-stone-100'
                          )}
                          title={s.status === 'ativa' ? 'Pausar' : 'Ativar'}
                        >
                          {s.status === 'ativa' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => { setEditing(s); setModalOpen(true); }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(s)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <SurveyModal
            survey={editing}
            missoes={missoes}
            onClose={() => { setModalOpen(false); setEditing(null); }}
            onSaved={msg => setToast({ type: 'success', text: msg })}
            organizationId={orgId}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Excluir Pesquisa</h3>
                  <p className="text-xs text-zinc-500">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 mb-5">
                Tem certeza que deseja excluir <strong className="text-zinc-900">"{deleting.titulo}"</strong>? Todas as perguntas serão removidas permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleting(null)}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-zinc-600 hover:bg-stone-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border',
              toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            )}
          >
            {toast.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
              : <AlertCircle className="w-4 h-4 text-red-600" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
