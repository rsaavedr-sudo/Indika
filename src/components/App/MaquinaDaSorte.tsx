import React, { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, doc, updateDoc, getDoc,
  serverTimestamp, increment, query, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaquinaConfig {
  ativo: boolean;
  premioMin: number;
  premioMax: number;
  mensagemDesabilitada: string;
  mensagemPremio: string;
}

interface LogEntry {
  id: string;
  pontosGanhos: number;
  timestamp: any;
}

// ─── Slot symbols ─────────────────────────────────────────────────────────────

const SYMBOLS = ['🍋', '⭐', '🍒', '💎', '🎯', '🔔', '🍀', '🏆'];

function SlotReel({ spinning, finalSymbol }: { spinning: boolean; finalSymbol: string }) {
  const [display, setDisplay] = useState(finalSymbol);

  useEffect(() => {
    if (!spinning) { setDisplay(finalSymbol); return; }
    let i = 0;
    const interval = setInterval(() => {
      setDisplay(SYMBOLS[i % SYMBOLS.length]);
      i++;
    }, 80);
    return () => clearInterval(interval);
  }, [spinning, finalSymbol]);

  return (
    <div className={`
      w-20 h-20 flex items-center justify-center text-4xl rounded-xl border-2
      transition-all duration-200
      ${spinning
        ? 'bg-yellow-50 border-yellow-300 scale-105'
        : 'bg-white border-gray-200 shadow-inner'
      }
    `}>
      {display}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function MaquinaDaSorte() {
  const { profile, refreshProfile } = useAuth();
  const [config, setConfig] = useState<MaquinaConfig | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(['🍒', '⭐', '🍋']);
  const [result, setResult] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [played, setPlayed] = useState(false);
  const leverRef = useRef<HTMLButtonElement>(null);

  // Fetch global config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'maquina_da_sorte_config', 'global'));
        if (snap.exists()) {
          setConfig(snap.data() as MaquinaConfig);
        } else {
          // Default config if not set yet
          setConfig({
            ativo: true,
            premioMin: 1,
            premioMax: 1000,
            mensagemDesabilitada: 'A Máquina da Sorte não está disponível no momento.',
            mensagemPremio: 'Parabéns! Você ganhou {pontos} pontos!',
          });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Fetch recent logs for this user
  useEffect(() => {
    if (!profile?.id) return;
    const fetchLogs = async () => {
      try {
        const q = query(
          collection(db, 'maquina_da_sorte_logs'),
          orderBy('timestamp', 'desc'),
          limit(5)
        );
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LogEntry[]);
      } catch (e) { /* ignore */ }
    };
    fetchLogs();
  }, [profile?.id, played]);

  // Global active + user not explicitly disabled = habilitada
  const isHabilitada =
    config?.ativo &&
    (profile as any)?.maquinaDaSorteHabilitada !== false;

  const handleSpin = async () => {
    if (!profile?.id || !config || spinning) return;
    setSpinning(true);
    setResult(null);

    // Random prize
    const pontos = Math.floor(
      Math.random() * (config.premioMax - config.premioMin + 1) + config.premioMin
    );

    // Pick random symbols (win look if big prize)
    const newReels = [
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    ];

    // Animate for 2 seconds
    await new Promise(r => setTimeout(r, 2000));

    setSpinning(false);
    setReels(newReels);
    setResult(pontos);

    // Update Firestore
    try {
      const docId = profile.id;

      // Credit points
      await updateDoc(doc(db, 'usuarios', docId), {
        pontos: increment(pontos),
      });

      // Transaction record
      await addDoc(collection(db, 'transacoes_pontos'), {
        userId: profile.uid || docId,
        userName: `${profile.nome} ${profile.sobrenome}`,
        pontos,
        tipo: 'credito',
        origem: 'maquina_da_sorte',
        descricao: 'Prêmio obtido na Máquina da Sorte',
        saldoAnterior: profile.pontos,
        saldoNovo: profile.pontos + pontos,
        createdAt: serverTimestamp(),
      });

      // Log entry
      await addDoc(collection(db, 'maquina_da_sorte_logs'), {
        userId: profile.uid || docId,
        userName: `${profile.nome} ${profile.sobrenome}`,
        pontosGanhos: pontos,
        status: 'ganhou',
        timestamp: serverTimestamp(),
        configSnapshot: { premioMin: config.premioMin, premioMax: config.premioMax },
      });

      await refreshProfile();
      setPlayed(p => !p);
    } catch (e) {
      console.error('Erro ao registrar prêmio:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A2540]" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#0A2540]">🎰 Máquina da Sorte</h1>
        <p className="text-slate-500 text-sm mt-1">
          {isHabilitada ? 'Sua sorte está esperando!' : 'Indisponível no momento'}
        </p>
      </div>

      {/* Machine */}
      <div className={`
        rounded-2xl border-2 p-6 text-center transition-all duration-500
        ${isHabilitada
          ? 'bg-gradient-to-b from-yellow-50 to-amber-50 border-yellow-300 shadow-lg'
          : 'bg-gray-50 border-gray-200 opacity-60 grayscale'
        }
      `}>
        {/* Reels */}
        <div className="flex justify-center gap-3 mb-6">
          {reels.map((sym, i) => (
            <SlotReel key={i} spinning={spinning} finalSymbol={sym} />
          ))}
        </div>

        {/* Result */}
        {result !== null && !spinning && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl animate-bounce-once">
            <p className="text-2xl font-extrabold text-green-600">+{result} pontos!</p>
            <p className="text-sm text-green-500 mt-1">
              {config?.mensagemPremio.replace('{pontos}', String(result))}
            </p>
          </div>
        )}

        {/* Lever / Button */}
        {isHabilitada ? (
          <button
            ref={leverRef}
            onClick={handleSpin}
            disabled={spinning}
            className={`
              w-full py-4 rounded-xl font-bold text-lg transition-all duration-200
              ${spinning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#0A2540] hover:bg-[#1E3A8A] text-white shadow-lg hover:shadow-xl active:scale-95'
              }
            `}
          >
            {spinning ? '🎰 Girando...' : '🎰 Acionar a Máquina!'}
          </button>
        ) : (
          <div className="py-4 px-6 bg-gray-100 rounded-xl text-gray-400 text-sm">
            🔒 {config?.mensagemDesabilitada}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Seus pontos</p>
        <p className="text-3xl font-extrabold text-[#0A2540]">
          {profile?.pontos.toLocaleString('pt-BR')}
          <span className="text-sm font-normal text-slate-400 ml-2">pts</span>
        </p>
      </div>

      {/* Recent logs */}
      {logs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Últimos prêmios</p>
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-500">
                  {log.timestamp?.toDate
                    ? log.timestamp.toDate().toLocaleDateString('pt-BR')
                    : '—'}
                </span>
                <span className="text-sm font-bold text-green-600">+{log.pontosGanhos} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
