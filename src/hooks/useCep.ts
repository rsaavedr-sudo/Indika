import { useState, useCallback, useRef } from 'react';

export interface CepData {
  cep: string;
  uf: string;
  cidade: string;
  bairro: string;
  logradouro: string;
}

interface UseCepReturn {
  cepData: CepData | null;
  cepLoading: boolean;
  cepError: string | null;
  lookupCep: (cep: string) => Promise<void>;
  clearCepData: () => void;
}

/**
 * Formats a CEP string to XXXXX-XXX format.
 * Accepts any input and strips non-digits.
 */
export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

/**
 * Returns only the digits of a CEP string.
 */
export function cepDigits(cep: string): string {
  return cep.replace(/\D/g, '');
}

/**
 * Hook for Brazilian CEP lookup via ViaCEP public API.
 * Triggers automatically when a full 8-digit CEP is provided.
 * Includes debouncing to avoid redundant requests.
 */
export function useCep(): UseCepReturn {
  const [cepData, setCepData] = useState<CepData | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const lastLookedUp = useRef<string>('');

  const lookupCep = useCallback(async (cep: string) => {
    const digits = cepDigits(cep);

    // Only lookup when we have exactly 8 digits
    if (digits.length !== 8) {
      setCepData(null);
      setCepError(null);
      return;
    }

    // Avoid duplicate requests for the same CEP
    if (digits === lastLookedUp.current) return;
    lastLookedUp.current = digits;

    setCepLoading(true);
    setCepError(null);
    setCepData(null);

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);

      if (!res.ok) throw new Error('Erro ao consultar o CEP.');

      const data = await res.json();

      // ViaCEP returns { erro: true } when CEP is not found
      if (data.erro) {
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
        setCepData(null);
        return;
      }

      setCepData({
        cep: data.cep ?? cep,
        uf: data.uf ?? '',
        cidade: data.localidade ?? '',
        bairro: data.bairro ?? '',
        logradouro: data.logradouro ?? '',
      });
    } catch {
      setCepError('Não foi possível consultar o CEP. Preencha manualmente.');
      setCepData(null);
    } finally {
      setCepLoading(false);
    }
  }, []);

  const clearCepData = useCallback(() => {
    setCepData(null);
    setCepError(null);
    lastLookedUp.current = '';
  }, []);

  return { cepData, cepLoading, cepError, lookupCep, clearCepData };
}
