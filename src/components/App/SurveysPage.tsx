import React, { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, getDocs,
  doc, updateDoc, serverTimestamp, Timestamp,
  where, orderBy, runTransaction,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardList, Clock, Star, ChevronRight, CheckCircle2,
  Loader2, AlertCircle, X, ArrowLeft, ChevronDown,
  Award, ListChecks, AlignLeft, ToggleLeft,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type SurveyTipo = 'premiada' | 'perfilamento' | 'engagement' | 'patrocinada';

interface Survey {
  id: string;
  titulo: string;
  descricao: string;
  tipo: SurveyTipo;
  status: 'rascunho' | 'ativa' | 'pausada' | 'arquivada';
  pontos: number;
  estimatedMinutes: number;
  missionId?: string | null;
  organizationId: string;
  totalRespostas: number;
  createdAt: Timestamp;
}

interface SurveyQuestion {
  id: string;
  ordem: number;
  tipo: 'unica' | 'multipla' | 'texto' | 'sino';
  texto: string;
  opcoes: string[];
  obrigatorio: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<SurveyTipo, string> = {
  premiada:    'Premiada',
  perfilamento:'Perfilamento',
  engagement:  'Engajamento',
  patrocinada: 'Patrocinada',
};

const TIPO_COLORS: Record<SurveyTipo, string> = {
  premiada:    'bg-amber-50 text-amber-700',
  perfilamento:'bg-blue-50 text-blue-700',
  engagement:  'bg-violet-50 text-violet-700',
  patrocinada: 'bg-emerald-50 text-emerald-700',
};

// ─── Survey Answer Form ───────────────────────────────────────────────────────

function SurveyForm({
  survey,
  questions,
  onSubmit,
  onBack,
  submitting,
}: {
  survey: Survey;
  questions: SurveyQuestion[];
  onSubmit: (answers: Record<string, string | string[]>) => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const q = questions[currentStep];
  const isLast = currentStep === questions.length - 1;
  const progress = ((currentStep) / questions.length) * 100;

  const setAnswer = (qId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
    setError(null);
  };

  const toggleMulti = (qId: string, option: string) => {
    const current = (answers[qId] as string[]) ?? [];
    const updated = current.includes(option)
      ? current.filter(x => x !== option)
      : [...current, option];
    setAnswer(qId, updated);
  };

  const canProceed = () => {
    if (!q.obrigatorio) return true;
    const ans = answers[q.id];
    if (!ans) return false;
    if (Array.isArray(ans)) return ans.length > 0;
    return ans.trim() !== '';
  };

  const handleNext = () => {
    if (!canProceed()) {
      setError('Esta pergunta é obrigatória. Por favor, responda antes de continuar.');
      return;
    }
    setError(null);
    if (isLast) {
      onSubmit(answers);
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  if (!q) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <h2 className="text-lg font-bold text-zinc-900">{survey.titulo}</h2>
        {survey.descricao && <p className="text-sm text-zinc-500 mt-1">{survey.descricao}</p>}
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500">
            Pergunta {currentStep + 1} de {questions.length}
          </span>
          <span className="text-xs font-medium text-indigo-600">{Math.round(((currentStep + 1) / questions.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500 rounded-full"
            animate={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4"
        >
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {currentStep + 1}
            </span>
            <p className="text-sm font-semibold text-zinc-800 leading-relaxed">
              {q.texto}
              {q.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </p>
          </div>

          {/* Opção única */}
          {q.tipo === 'unica' && (
            <div className="space-y-2 pl-9">
              {q.opcoes.map(op => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setAnswer(q.id, op)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition-all text-left',
                    answers[q.id] === op
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                      : 'border-stone-200 hover:border-stone-300 text-zinc-700'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                    answers[q.id] === op ? 'border-indigo-500 bg-indigo-500' : 'border-stone-300'
                  )}>
                    {answers[q.id] === op && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  {op}
                </button>
              ))}
            </div>
          )}

          {/* Múltipla escolha */}
          {q.tipo === 'multipla' && (
            <div className="space-y-2 pl-9">
              {q.opcoes.map(op => {
                const selected = ((answers[q.id] as string[]) ?? []).includes(op);
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => toggleMulti(q.id, op)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition-all text-left',
                      selected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                        : 'border-stone-200 hover:border-stone-300 text-zinc-700'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center',
                      selected ? 'border-indigo-500 bg-indigo-500' : 'border-stone-300'
                    )}>
                      {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    {op}
                  </button>
                );
              })}
              <p className="text-xs text-zinc-400 italic">Selecione todas que se aplicam</p>
            </div>
          )}

          {/* Texto livre */}
          {q.tipo === 'texto' && (
            <div className="pl-9">
              <textarea
                value={(answers[q.id] as string) ?? ''}
                onChange={e => setAnswer(q.id, e.target.value)}
                rows={3}
                placeholder="Digite sua resposta..."
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-stone-50 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all resize-none"
              />
            </div>
          )}

          {/* Sim / Não */}
          {q.tipo === 'sino' && (
            <div className="flex gap-3 pl-9">
              {['Sim', 'Não'].map(op => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setAnswer(q.id, op)}
                  className={cn(
                    'flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                    answers[q.id] === op
                      ? op === 'Sim'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-red-400 bg-red-50 text-red-700'
                      : 'border-stone-200 hover:border-stone-300 text-zinc-600'
                  )}
                >
                  {op}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {currentStep > 0 && (
          <button
            type="button"
            onClick={() => { setCurrentStep(s => s - 1); setError(null); }}
            disabled={submitting}
            className="px-4 py-3 rounded-xl border border-stone-200 text-sm font-medium text-zinc-600 hover:bg-stone-50 transition-all"
          >
            ← Anterior
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="flex-1 py-3 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
          ) : isLast ? (
            <><CheckCircle2 className="w-4 h-4" /> Enviar Respostas</>
          ) : (
            <>Próxima <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Survey Card ──────────────────────────────────────────────────────────────

function SurveyCard({
  survey,
  completed,
  onStart,
}: {
  survey: Survey;
  completed: boolean;
  onStart: () => void | Promise<void>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white rounded-2xl border p-4 transition-all',
        completed ? 'border-stone-200 opacity-70' : 'border-stone-200 hover:border-indigo-200 hover:shadow-md cursor-pointer'
      )}
      onClick={!completed ? onStart : undefined}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          completed ? 'bg-stone-100' : 'bg-amber-50'
        )}>
          {completed
            ? <CheckCircle2 className="w-5 h-5 text-stone-400" />
            : <ClipboardList className="w-5 h-5 text-amber-600" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className={cn('text-sm font-semibold leading-tight', completed ? 'text-zinc-500' : 'text-zinc-900')}>
                {survey.titulo}
              </h3>
              {survey.descricao && (
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{survey.descricao}</p>
              )}
            </div>
            {!completed && (
              <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TIPO_COLORS[survey.tipo])}>
              {TIPO_LABELS[survey.tipo]}
            </span>
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <Clock className="w-3 h-3" />
              ~{survey.estimatedMinutes} min
            </span>
            {completed ? (
              <span className="flex items-center gap-1 text-xs text-stone-400 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                Respondida
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
                <Award className="w-3 h-3" />
                +{survey.pontos.toLocaleString('pt-BR')} pts
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SurveysPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<SurveyQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const orgId = (profile as any)?.organizationId ?? '';

  // Load active surveys
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'surveys'),
      where('organizationId', '==', orgId),
      where('status', '==', 'ativa'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setSurveys(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Survey, 'id'>) })));
      setLoading(false);
    });
    return unsub;
  }, [orgId]);

  // Load completed surveys for user
  useEffect(() => {
    if (!user || !orgId) return;
    const q = query(
      collection(db, 'survey_responses'),
      where('userId', '==', user.uid),
      where('organizationId', '==', orgId)
    );
    const unsub = onSnapshot(q, snap => {
      setCompletedIds(new Set(snap.docs.map(d => d.data().surveyId)));
    });
    return unsub;
  }, [user, orgId]);

  const startSurvey = async (survey: Survey) => {
    setLoadingQuestions(true);
    setActiveSurvey(survey);
    setSubmitted(false);
    setError(null);
    try {
      const q = query(
        collection(db, 'survey_questions'),
        where('surveyId', '==', survey.id),
        orderBy('ordem', 'asc')
      );
      const snap = await getDocs(q);
      setActiveQuestions(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SurveyQuestion, 'id'>) })));
    } catch (e) {
      setError('Erro ao carregar pesquisa. Tente novamente.');
      setActiveSurvey(null);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSubmit = async (answers: Record<string, string | string[]>) => {
    if (!user || !activeSurvey || !profile) return;
    setSubmitting(true);
    setError(null);

    try {
      // Check for duplicate response
      const existing = await getDocs(query(
        collection(db, 'survey_responses'),
        where('surveyId', '==', activeSurvey.id),
        where('userId', '==', user.uid)
      ));
      if (!existing.empty) {
        setError('Você já respondeu esta pesquisa.');
        setSubmitting(false);
        return;
      }

      const profileId = (profile as any).id ?? user.uid;

      // Use runTransaction to award points atomically
      const responseRef = doc(collection(db, 'survey_responses'));

      await runTransaction(db, async tx => {
        const userRef = doc(db, 'usuarios', profileId);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Usuário não encontrado');

        const currentPontos = (userSnap.data().pontos as number) ?? 0;

        // Create survey_response
        tx.set(responseRef, {
          surveyId: activeSurvey.id,
          userId: user.uid,
          organizationId: orgId,
          pontos_earned: activeSurvey.pontos,
          completedAt: serverTimestamp(),
        });

        // Award points
        tx.update(userRef, {
          pontos: currentPontos + activeSurvey.pontos,
          updatedAt: serverTimestamp(),
        });

        // Create transaction record
        const txRef = doc(collection(db, 'transactions'));
        tx.set(txRef, {
          user_id: user.uid,
          organizationId: orgId,
          type: 'earn',
          pontos: activeSurvey.pontos,
          description: `Pesquisa: ${activeSurvey.titulo}`,
          surveyId: activeSurvey.id,
          created_at: serverTimestamp(),
        });

        // Increment totalRespostas counter on survey
        const surveyRef = doc(db, 'surveys', activeSurvey.id);
        tx.update(surveyRef, {
          totalRespostas: (activeSurvey.totalRespostas ?? 0) + 1,
          updatedAt: serverTimestamp(),
        });
      });

      // Save individual answer items
      await Promise.all(
        Object.entries(answers).map(([questionId, valor]) =>
          addDoc(collection(db, 'survey_response_items'), {
            responseId: responseRef.id,
            surveyId: activeSurvey.id,
            questionId,
            userId: user.uid,
            organizationId: orgId,
            valor: Array.isArray(valor) ? valor : valor,
            createdAt: serverTimestamp(),
          })
        )
      );

      await refreshProfile();
      setEarnedPoints(activeSurvey.pontos);
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      setError('Erro ao enviar respostas. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const available = surveys.filter(s => !completedIds.has(s.id));
  const done = surveys.filter(s => completedIds.has(s.id));

  // ── Submitted success screen ──
  if (submitted && activeSurvey) {
    return (
      <div className="flex-1 p-4 md:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm mx-auto text-center pt-12"
        >
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Pesquisa Concluída!</h2>
          <p className="text-sm text-zinc-500 mb-5">
            Obrigado por participar. Sua contribuição é muito importante.
          </p>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 inline-block">
            <p className="text-xs font-medium text-amber-600 mb-1">Pontos ganhos</p>
            <p className="text-3xl font-bold text-amber-700">+{earnedPoints.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-amber-500 mt-1">pts adicionados à sua conta</p>
          </div>
          <button
            onClick={() => { setActiveSurvey(null); setSubmitted(false); }}
            className="w-full py-3 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 transition-all"
          >
            Ver mais pesquisas
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Active survey ──
  if (activeSurvey) {
    return (
      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-lg mx-auto">
          {loadingQuestions ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            </div>
          ) : activeQuestions.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Esta pesquisa não tem perguntas configuradas.</p>
              <button
                onClick={() => setActiveSurvey(null)}
                className="mt-4 text-sm text-indigo-500 hover:text-indigo-700 font-medium"
              >
                ← Voltar
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <SurveyForm
                survey={activeSurvey}
                questions={activeQuestions}
                onSubmit={handleSubmit}
                onBack={() => setActiveSurvey(null)}
                submitting={submitting}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Survey list ──
  return (
    <div className="flex-1 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Pesquisas</h1>
          <p className="text-xs text-zinc-500">
            {available.length} disponível{available.length !== 1 ? 'is' : ''}
            {done.length > 0 && ` · ${done.length} concluída${done.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : surveys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <ClipboardList className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhuma pesquisa disponível</p>
          <p className="text-xs mt-1">Volte em breve para ver novas pesquisas</p>
        </div>
      ) : (
        <>
          {/* Available surveys */}
          {available.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Disponíveis</h2>
              {available.map(s => (
                <SurveyCard
                  key={s.id}
                  survey={s}
                  completed={false}
                  onStart={() => startSurvey(s)}
                />
              ))}
            </div>
          )}

          {/* Completed surveys */}
          {done.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Concluídas</h2>
              {done.map(s => (
                <SurveyCard
                  key={s.id}
                  survey={s}
                  completed={true}
                  onStart={() => {}}
                />
              ))}
            </div>
          )}

          {available.length === 0 && done.length > 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-zinc-400">Você já respondeu todas as pesquisas disponíveis. Parabéns!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
