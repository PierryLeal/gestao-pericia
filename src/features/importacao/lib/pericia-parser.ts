import type { PericiaInput } from '../../pericias/schemas';

export type PericiaParseada = {
  autor: string;
  reu: string;
  numeroProcesso: string;
};

/**
 * "autor x réu - número do processo". The LAST " - " is treated as the
 * autor/réu ↔ número boundary, since a processo número never contains a
 * space-hyphen-space sequence but an autor/réu name occasionally does
 * (e.g. a compound surname).
 */
export function parseColunaPericia(texto: string): PericiaParseada | null {
  const trimmed = texto.trim();
  const lastDashIndex = trimmed.lastIndexOf(' - ');
  if (lastDashIndex === -1) return null;

  const nomePart = trimmed.slice(0, lastDashIndex).trim();
  const numeroProcesso = trimmed.slice(lastDashIndex + 3).trim();
  if (!nomePart || !numeroProcesso) return null;

  // " x " as a standalone word (surrounded by whitespace), not a letter inside
  // a name like "Alex" or "Max".
  const xMatch = nomePart.match(/^(.*?)\s+x\s+(.*)$/i);
  if (xMatch) {
    return { autor: xMatch[1].trim(), reu: xMatch[2].trim(), numeroProcesso };
  }
  return { autor: nomePart, reu: 'Vale', numeroProcesso };
}

export function mapSituacao(valor: string): { situacao: PericiaInput['situacao']; reconhecida: boolean } {
  const trimmed = valor.trim().toLowerCase();
  if (!trimmed) return { situacao: 'pendente', reconhecida: true };
  if (trimmed === 'campo') return { situacao: 'marcada', reconhecida: true };
  return { situacao: 'pendente', reconhecida: false };
}
