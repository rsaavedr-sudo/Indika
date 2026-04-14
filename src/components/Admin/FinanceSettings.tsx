import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Loader2, Save, CheckCircle2, AlertCircle, DollarSign, Settings2, Info } from 'lucide-react';

interface FinanceConfig {
  points_to_brl_rate: number;   // e.g. 100 = 100pts → R$1
  minimum_withdraw_brl: number; // e.g. 10 = R$10 minimum
  updatedAt?: any;
  updatedBy?: string;
}

const DEFAULTS: FinanceConfig = {
  points_to_brl_rate: 100,
  minimum_withdraw_brl: 10,
};

export default function FinanceSettings() {
  const { profile } = useAuth();
  const [config, setConfig] = useState<FinanceConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'finance'));
        if (snap.exists()) setConfig({ ...DEFAULTS, ...snap.data() as FinanceConfig });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'finance'), {
        ...config,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.uid,
      });
      setToast({ ok: true, msg: 'Configurações salvas com sucesso.' });
    } catch {
      setToast({ ok: false, msg: 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  };

  const brlPerPoint = config.points_to_brl_rate > 0
    ? (1 / config.points_to_brl_rate)
    : 0;
  const minPoints = config.minimum_withdraw_brl * config.points_to_brl_rate;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Configurações Financeiras</h2>
          <p className="text-xs text-stone-500">Taxa de conversão e limites de saque via Pix</p>
        </div>
      </div>

      {toast && (
        <div className={`mb-5 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium
          ${toast.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Rate */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-zinc-800">Taxa de Conversão</h3>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Pontos necessários para cada R$1,00
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                required
                value={config.points_to_brl_rate}
                onChange={e => setConfig({ ...config, points_to_brl_rate: Number(e.target.value) })}
                className="w-40 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 outline-none text-sm font-mono"
              />
              <span className="text-sm text-stone-500">pts = R$1,00</span>
            </div>
          </div>
          {/* Preview */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2 text-xs text-amber-800">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Com essa taxa: <strong>1 ponto = R${brlPerPoint.toFixed(4)}</strong>.
              Um usuário com <strong>1.000 pts</strong> pode sacar <strong>R${(1000 / config.points_to_brl_rate).toFixed(2)}</strong>.
            </span>
          </div>
        </div>

        {/* Minimum */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <h3 className="font-semibold text-zinc-800">Limites de Saque</h3>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Valor mínimo de saque (R$)
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-stone-400 font-medium">R$</span>
              <input
                type="number"
                min={1}
                step={0.01}
                required
                value={config.minimum_withdraw_brl}
                onChange={e => setConfig({ ...config, minimum_withdraw_brl: Number(e.target.value) })}
                className="w-40 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 outline-none text-sm font-mono"
              />
            </div>
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-xs text-stone-600">
            O usuário precisa ter pelo menos <strong>{minPoints.toLocaleString('pt-BR')} pontos</strong> para solicitar um saque.
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-semibold py-2.5 px-6 rounded-xl transition-all text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Configurações
          </button>
        </div>
      </form>
    </div>
  );
}
