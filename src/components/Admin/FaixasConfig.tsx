import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { DEFAULT_FAIXAS, FaixaConfig } from '../../utils/faixas';
import { Save, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FaixaEditable {
  id: string;
  nome: string;
  emoji: string;
  pontosMin: number;
  pontosMax: number | null;
  cor: string;
  bgClass: string;
  badgeBg: string;
  textClass: string;
  borderClass: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FaixasConfig() {
  const [faixas, setFaixas] = useState<FaixaEditable[]>(DEFAULT_FAIXAS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Load from Firestore
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'faixas'));
        if (snap.exists() && snap.data().faixas) {
          setFaixas(snap.data().faixas as FaixaEditable[]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleChange = (idx: number, field: 'pontosMin' | 'pontosMax', raw: string) => {
    const val = raw === '' ? null : Number(raw);
    setFaixas(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleSave = async () => {
    // Validate ascending order
    for (let i = 1; i < faixas.length; i++) {
      if (faixas[i].pontosMin <= faixas[i - 1].pontosMin) {
        setToast({ msg: 'Os pontos mínimos devem ser em ordem crescente.', ok: false });
        return;
      }
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'faixas'), {
        faixas,
        updatedAt: serverTimestamp(),
      });
      setToast({ msg: 'Configuração salva com sucesso!', ok: true });
    } catch (e) {
      console.error(e);
      setToast({ msg: 'Erro ao salvar. Tente novamente.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">Configuração de Faixas</h2>
          <p className="text-sm text-slate-500 mt-1">
            Defina os pontos necessários para cada nível. A Faixa Branca sempre começa em 0.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow text-sm transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      {toast && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium',
          toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        )}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Faixas list */}
      <div className="space-y-3">
        {faixas.map((f, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === faixas.length - 1;
          const nextMin = idx < faixas.length - 1 ? faixas[idx + 1].pontosMin : null;

          return (
            <div
              key={f.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              {/* Left: badge + name */}
              <div className="flex items-center gap-3 sm:w-48 flex-shrink-0">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border',
                  f.bgClass, f.borderClass
                )}>
                  {f.emoji}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{f.nome}</p>
                  <p className={cn('text-xs font-semibold', f.textClass)}>
                    {isLast ? `${f.pontosMin.toLocaleString('pt-BR')}+ pts` : `${f.pontosMin.toLocaleString('pt-BR')} – ${(nextMin! - 1).toLocaleString('pt-BR')} pts`}
                  </p>
                </div>
              </div>

              {/* Right: fields */}
              <div className="flex-1 grid grid-cols-2 gap-3">
                {/* Pontos mínimos */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Pontos mínimos
                  </label>
                  {isFirst ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-400">
                      <Lock className="w-3.5 h-3.5" /> 0 (fixo)
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={faixas[idx - 1].pontosMin + 1}
                      value={f.pontosMin}
                      onChange={e => handleChange(idx, 'pontosMin', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  )}
                </div>

                {/* Pontos máximos (display only) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Pontos máximos
                  </label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-400 flex items-center gap-2">
                    {isLast ? (
                      <><Lock className="w-3.5 h-3.5" /> Sem limite</>
                    ) : (
                      <span className="font-semibold text-slate-600">
                        {(faixas[idx + 1].pontosMin - 1).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual progression */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Progressão Visual</p>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {faixas.map((f, idx) => (
            <React.Fragment key={f.id}>
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-lg shadow border-2', f.bgClass, f.borderClass)}>
                  {f.emoji}
                </div>
                <span className="text-[10px] font-bold text-slate-600 text-center w-16">{f.nome.replace('Faixa ', '')}</span>
                <span className="text-[9px] text-slate-400">{f.pontosMin.toLocaleString('pt-BR')}+</span>
              </div>
              {idx < faixas.length - 1 && (
                <div className="flex-1 min-w-8 h-1 bg-gradient-to-r from-slate-200 to-slate-300 mx-1 rounded-full" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-700">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          As faixas são calculadas automaticamente com base nos pontos do usuário.
          Alterações aqui afetam todos os usuários imediatamente.
          O campo "Faixa atual" no cadastro do usuário permite ajustes manuais por usuário.
        </p>
      </div>
    </div>
  );
}
