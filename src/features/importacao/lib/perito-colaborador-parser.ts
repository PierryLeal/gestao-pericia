import { normalizeForSearch } from '@/lib/search';
import type { PeritoInput } from '../../peritos/schemas';

export function mapJaTrabalhamos(texto: string): boolean {
  const trimmed = texto.trim().toLowerCase();
  return trimmed === 'sim' || trimmed === 'x';
}

const RELACAO_VALORES: PeritoInput['relacao'][] = ['ruim', 'neutra', 'boa', 'otima'];

export function mapRelacao(texto: string): { relacao: PeritoInput['relacao']; reconhecida: boolean } {
  // Accent-insensitive: a sheet cell like "ÓTIMA" must still match 'otima'.
  const normalizado = normalizeForSearch(texto);
  if (!normalizado) return { relacao: 'neutra', reconhecida: true };
  const encontrada = RELACAO_VALORES.find((v) => v === normalizado);
  return encontrada ? { relacao: encontrada, reconhecida: true } : { relacao: 'neutra', reconhecida: false };
}

const RESULTADO_VALORES: PeritoInput['resultados'][] = ['negativo', 'parcial', 'positivo'];

export function mapResultados(texto: string): { resultados: PeritoInput['resultados']; reconhecida: boolean } {
  const normalizado = normalizeForSearch(texto);
  if (!normalizado) return { resultados: 'parcial', reconhecida: true };
  const encontrada = RESULTADO_VALORES.find((v) => v === normalizado);
  return encontrada ? { resultados: encontrada, reconhecida: true } : { resultados: 'parcial', reconhecida: false };
}
