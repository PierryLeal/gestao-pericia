import { situacaoOptions, type PericiaInput } from '../../pericias/schemas';

export type PericiaParseada = {
  autor: string;
  reu: string;
  numeroProcesso: string;
};

// The CNJ "número único" format (Resolução 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO.
// Sheets are inconsistent about the separator before it ("Nome - 123...",
// "Nome- 123...", "Nome – 123...", "Nome -123..."), so once a number in this
// exact, unambiguous shape is found anywhere in the cell, it's trusted over
// any particular separator character.
const NUMERO_PROCESSO_CNJ_REGEX = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;

function extrairAutorReu(nomePart: string): { autor: string; reu: string } {
  // " x " as a standalone word (surrounded by whitespace), not a letter inside
  // a name like "Alex" or "Max".
  const xMatch = nomePart.match(/^(.*?)\s+x\s+(.*)$/i);
  if (xMatch) return { autor: xMatch[1].trim(), reu: xMatch[2].trim() };
  return { autor: nomePart, reu: 'Vale' };
}

/**
 * "autor x réu - número do processo". Prefers locating a CNJ-format número
 * anywhere in the cell; falls back to the last " - " as the autor/réu ↔
 * número boundary for the rare número that isn't in that format (a processo
 * número never contains a space-hyphen-space sequence, but an autor/réu name
 * occasionally does, e.g. a compound surname).
 */
export function parseColunaPericia(texto: string): PericiaParseada | null {
  const trimmed = texto.trim();

  const cnjMatch = trimmed.match(NUMERO_PROCESSO_CNJ_REGEX);
  if (cnjMatch) {
    const numeroProcesso = cnjMatch[0];
    const nomePart = trimmed.slice(0, cnjMatch.index).replace(/[-–—\s]+$/, '').trim();
    if (!nomePart) return { autor: '', reu: '', numeroProcesso };
    return { ...extrairAutorReu(nomePart), numeroProcesso };
  }

  const lastDashIndex = trimmed.lastIndexOf(' - ');
  if (lastDashIndex === -1) return null;

  const nomePart = trimmed.slice(0, lastDashIndex).trim();
  const numeroProcesso = trimmed.slice(lastDashIndex + 3).trim();
  if (!nomePart || !numeroProcesso) return null;

  return { ...extrairAutorReu(nomePart), numeroProcesso };
}

/**
 * A perícia's CAMPO cell can list more than one colaborador, separated by
 * "/" (e.g. "Igor Navarro/Julio Cesar Mulatti").
 */
export function splitColaboradorNomes(texto: string): string[] {
  return texto.split('/').map((nome) => nome.trim()).filter(Boolean);
}

export function mapSituacao(valor: string): { situacao: PericiaInput['situacao']; reconhecida: boolean } {
  const trimmed = valor.trim().toLowerCase();
  if (!trimmed) return { situacao: 'pendente', reconhecida: true };
  if (trimmed === 'campo') return { situacao: 'marcada', reconhecida: true };
  if (trimmed === 'ok') return { situacao: 'realizada', reconhecida: true };
  const situacaoDireta = situacaoOptions.find((opcao) => opcao === trimmed);
  if (situacaoDireta) return { situacao: situacaoDireta, reconhecida: true };
  return { situacao: 'pendente', reconhecida: false };
}
