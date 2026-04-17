import React, { useState, useEffect } from 'react';
import {
  collection, doc, getDoc, setDoc, onSnapshot,
  query, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Dices, Settings, History, ToggleLeft, ToggleRight, Save } from 'lucide-react';

interface MaquinaConfig {
  ativo: boolean;
  premioMin: number;
  premioMax: number;
  mensagemDesabilitada: string;
  mensagemPremio: string;
}

interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  pontosGanhos: number;
  status: string;
  timestamp: any;
}

const DEFAULT_CONFIG: MaquinaConfig = {
  ativo: false,
  premioMin: 1,
  premioMax: 1000,
  mensagemDesabilitada: 'A Máquina da Sorte não está disponível no momento.',
  mensagemPremio: 'Parabéns! Você ganhou {pontos} pontos!',
};

export default function MaquinaDaSorteAdmin() {
  const [config, setConfig] = useState<MaquinaConfig>(DEFAULT_CONFIG);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'config' | 'logs'>('config');

  // Load config
  useEffect(() => {
    getDoc(doc(db, 'maquina_da_sorte_config', 'global')).then(snap => {
      if (snap.exists()) setConfig(snap.data() as MaquinaConfig);
    });
  }, []);

  // Load logs
  useEffect(() => {
    const q = query(
      collection(db, 'maquina_da_sorte_logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LogEntry[]);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'maquina_da_sorte_config', 'global'), config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const totalPontos = logs.reduce((s, l) => s + (l.pontosGanhos || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Dices className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0A2540]">Máquina da Sorte</h2>
            <p className="text-sm text-slate-500">Configuração e histórico</p>
          </div>
        </div>

        {/* Global toggle — saves immediately */}
        <button
          onClick={async () => {
            const newAtivo = !config.ativo;
            const newConfig = { ...config, ativo: newAtivo };
            setConfig(newConfig);
            try {
              await setDoc(doc(db, 'maquina_da_sorte_config', 'global'), newConfig);
            } catch (e) {
              console.error('Erro ao atualizar status:', e);
              setConfig(c => ({ ...c, ativo: !newAtivo })); // revert on error
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            config.ativo
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {config.ativo
            ? <><ToggleRight className="w-4 h-4" /> Ativa Globalmente</>
            : <><ToggleLeft className="w-4 h-4" /> Desativada</>
          }
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total de usos</p>
          <p className="text-2xl font-extrabold text-[#0A2540] mt-1">{logs.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pontos distribuídos</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{totalPontos.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Média por uso</p>
          <p className="text-2xl font-extrabold text-[#0A2540] mt-1">
            {logs.length ? Math.round(totalPontos / logs.length) : 0}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { key: 'config', label: 'Configuração', icon: <Settings className="w-4 h-4" /> },
          { key: 'logs', label: 'Histórico', icon: <History className="w-4 h-4" /> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-[#0A2540] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Config tab */}
      {tab === 'config' && (
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm space-y-5">
          <h3 className="font-bold text-[#0A2540]">Configuração Global</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1.5">Prêmio Mínimo (pts)</label>
              <input
                type="number"
                value={config.premioMin}
                onChange={e => setConfig(c => ({ ...c, premioMin: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1.5">Prêmio Máximo (pts)</label>
              <input
                type="number"
                value={config.premioMax}
                onChange={e => setConfig(c => ({ ...c, premioMax: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Mensagem quando desabilitada</label>
            <input
              type="text"
              value={config.mensagemDesabilitada}
              onChange={e => setConfig(c => ({ ...c, mensagemDesabilitada: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">
              Mensagem de prêmio <span className="text-slate-400 font-normal">(use {'{pontos}'} para mostrar o valor)</span>
            </label>
            <input
              type="text"
              value={config.mensagemPremio}
              onChange={e => setConfig(c => ({ ...c, mensagemPremio: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-4">
              Estrutura preparada para: limite diário, probabilidades por tramo, horários de ativação.
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[#0A2540] hover:bg-[#1E3A8A] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar Configuração'}
            </button>
          </div>
        </div>
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Usuário', 'Pontos Ganhos', 'Data/Hora', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-slate-400 py-8">Nenhum uso registrado ainda</td>
                </tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#0A2540]">{log.userName || log.userId}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-amber-600">+{log.pontosGanhos} pts</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {log.timestamp?.toDate
                      ? log.timestamp.toDate().toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold">
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
