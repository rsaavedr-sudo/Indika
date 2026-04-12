// ─── Faixas (Levels) System ────────────────────────────────────────────────────
// Central config for the 5-level progression system.
// Admin can override thresholds in Firestore `config/faixas`; these are defaults.

export type FaixaId = 'branca' | 'azul' | 'roxa' | 'marrom' | 'preta';

export interface FaixaConfig {
  id: FaixaId;
  nome: string;
  pontosMin: number;
  pontosMax: number | null; // null = no upper limit (top level)
  cor: string;           // hex for SVG / inline styles
  bgClass: string;       // Tailwind bg class for progress fill
  badgeBg: string;       // Tailwind bg for badges on dark backgrounds
  textClass: string;     // Tailwind text class on light bg
  borderClass: string;   // Tailwind border class
  emoji: string;
}

export const DEFAULT_FAIXAS: FaixaConfig[] = [
  {
    id: 'branca',
    nome: 'Faixa Branca',
    pontosMin: 0,
    pontosMax: 499,
    cor: '#94A3B8',
    bgClass: 'bg-slate-400',
    badgeBg: 'bg-slate-200',
    textClass: 'text-slate-600',
    borderClass: 'border-slate-300',
    emoji: '⚪',
  },
  {
    id: 'azul',
    nome: 'Faixa Azul',
    pontosMin: 500,
    pontosMax: 1999,
    cor: '#3B82F6',
    bgClass: 'bg-blue-500',
    badgeBg: 'bg-blue-400',
    textClass: 'text-blue-600',
    borderClass: 'border-blue-300',
    emoji: '🔵',
  },
  {
    id: 'roxa',
    nome: 'Faixa Roxa',
    pontosMin: 2000,
    pontosMax: 4999,
    cor: '#8B5CF6',
    bgClass: 'bg-violet-500',
    badgeBg: 'bg-violet-400',
    textClass: 'text-violet-600',
    borderClass: 'border-violet-300',
    emoji: '🟣',
  },
  {
    id: 'marrom',
    nome: 'Faixa Marrom',
    pontosMin: 5000,
    pontosMax: 9999,
    cor: '#92400E',
    bgClass: 'bg-amber-800',
    badgeBg: 'bg-amber-700',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-600',
    emoji: '🟤',
  },
  {
    id: 'preta',
    nome: 'Faixa Preta',
    pontosMin: 10000,
    pontosMax: null,
    cor: '#0F172A',
    bgClass: 'bg-slate-900',
    badgeBg: 'bg-slate-700',
    textClass: 'text-slate-900',
    borderClass: 'border-slate-700',
    emoji: '⚫',
  },
];

/** Return the correct faixa for a given point total */
export function getFaixaByPontos(pontos: number, faixas = DEFAULT_FAIXAS): FaixaConfig {
  for (let i = faixas.length - 1; i >= 0; i--) {
    if (pontos >= faixas[i].pontosMin) return faixas[i];
  }
  return faixas[0];
}

/** Return the next faixa after the current one (null if already at max) */
export function getNextFaixa(faixa: FaixaConfig, faixas = DEFAULT_FAIXAS): FaixaConfig | null {
  const idx = faixas.findIndex(f => f.id === faixa.id);
  return idx >= 0 && idx < faixas.length - 1 ? faixas[idx + 1] : null;
}

/** 0–100 progress percentage toward the next faixa */
export function getFaixaProgress(pontos: number, faixa: FaixaConfig): number {
  const next = getNextFaixa(faixa);
  if (!next) return 100;
  const range = next.pontosMin - faixa.pontosMin;
  const done = Math.max(0, pontos - faixa.pontosMin);
  return Math.min(100, Math.round((done / range) * 100));
}

/** Points remaining until next faixa */
export function getPontosParaProxima(pontos: number, faixa: FaixaConfig): number {
  const next = getNextFaixa(faixa);
  if (!next) return 0;
  return Math.max(0, next.pontosMin - pontos);
}
