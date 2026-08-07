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
