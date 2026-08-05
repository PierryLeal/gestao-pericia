import type { PeritoInput } from '../../peritos/schemas';

export function mapJaTrabalhamos(texto: string): boolean {
  const trimmed = texto.trim().toLowerCase();
  return trimmed === 'sim' || trimmed === 'x';
}

const RELACAO_VALORES: PeritoInput['relacao'][] = ['ruim', 'neutra', 'boa', 'otima'];

export function mapRelacao(texto: string): { relacao: PeritoInput['relacao']; reconhecida: boolean } {
  const trimmed = texto.trim().toLowerCase();
  if (!trimmed) return { relacao: 'neutra', reconhecida: true };
  const encontrada = RELACAO_VALORES.find((v) => v === trimmed);
  return encontrada ? { relacao: encontrada, reconhecida: true } : { relacao: 'neutra', reconhecida: false };
}

const RESULTADO_VALORES: PeritoInput['resultados'][] = ['negativo', 'parcial', 'positivo'];

export function mapResultados(texto: string): { resultados: PeritoInput['resultados']; reconhecida: boolean } {
  const trimmed = texto.trim().toLowerCase();
  if (!trimmed) return { resultados: 'parcial', reconhecida: true };
  const encontrada = RESULTADO_VALORES.find((v) => v === trimmed);
  return encontrada ? { resultados: encontrada, reconhecida: true } : { resultados: 'parcial', reconhecida: false };
}
