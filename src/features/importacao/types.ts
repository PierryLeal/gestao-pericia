import type { PericiaInput } from '../pericias/schemas';
import type { PeritoInput } from '../peritos/schemas';

export type PreviewStatus = 'ok' | 'atencao' | 'duplicada' | 'suspeito';

export type NaoProcessada = {
  linhaOriginal: number;
  texto: string;
  motivo: string;
};

export type PericiaPreviewRow = {
  linhaOriginal: number;
  status: PreviewStatus;
  motivos: string[];
  processoNumero: string;
  processoAutor: string;
  processoReu: string;
  processoEscritorio: string;
  processoIdExistente: number | null;
  dataAgendada: string | null;
  horaAgendada: string | null;
  municipioId: number | null;
  municipioNome: string;
  municipioUf: string;
  peritoNome: string;
  peritoIdExistente: number | null;
  colaboradorNome: string;
  colaboradorIdsExistentes: number[];
  situacao: PericiaInput['situacao'];
  observacoes: string | null;
  contrato: string | null;
};

export type PreviewImportacaoPericiasResult = {
  linhas: PericiaPreviewRow[];
  naoProcessadas: NaoProcessada[];
};

/** A row that could not be written, with the reason, so the report can surface it. */
export type LinhaComErro = {
  linhaOriginal: number;
  erro: string;
};

export type RelatorioImportacaoPericias = {
  processosCriados: number;
  processosAtualizados: number;
  periciasCriadas: number;
  peritosCriados: number;
  colaboradoresCriados: number;
  puladasPorDuplicidade: number;
  linhasComErro: LinhaComErro[];
  /** The row WAS saved, but something had to be dropped/adjusted to make that
   *  possible (e.g. a colaborador conflicted and was left unlinked) — distinct
   *  from linhasComErro, where the row was not saved at all. */
  linhasComAviso: LinhaComErro[];
  /** The row was intentionally NOT saved because it's an exact duplicate of
   *  another perícia (same processo/data/hora/perito/colaborador(es)) — either
   *  already in the database or earlier in this same sheet. Kept apart from
   *  linhasComErro/linhasComAviso since this isn't a failure or a compromise,
   *  it's by design (creating it would double-book the same real perícia). */
  linhasPuladasPorDuplicidade: LinhaComErro[];
};

export type ColaboradorPreviewRow = {
  linhaOriginal: number;
  status: PreviewStatus;
  motivo: string | null;
  nome: string;
  contato: string;
  idExistente: number | null;
};

export type PeritoPreviewRow = {
  linhaOriginal: number;
  status: PreviewStatus;
  motivo: string | null;
  nome: string;
  contato: string;
  formacao: string;
  crea: string;
  documento: string;
  jaTrabalhamos: boolean;
  relacao: PeritoInput['relacao'];
  resultados: PeritoInput['resultados'];
  idExistente: number | null;
};

export type PreviewImportacaoPeritosColaboradoresResult = {
  colaboradores: ColaboradorPreviewRow[];
  peritos: PeritoPreviewRow[];
  naoProcessadas: NaoProcessada[];
};

export type RelatorioImportacaoPeritosColaboradores = {
  peritosCriados: number;
  peritosAtualizados: number;
  colaboradoresCriados: number;
  colaboradoresAtualizados: number;
  linhasComErro: LinhaComErro[];
};
