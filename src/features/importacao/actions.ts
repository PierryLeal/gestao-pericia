'use server';

import ExcelJS from 'exceljs';
import { requireRole } from '@/features/auth/guards';
import { searchMunicipios } from '@/lib/ibge/client';
import { normalizeForSearch } from '@/lib/search';
import { createProcesso, updateProcesso, listProcessos } from '@/features/processos/actions';
import { createPerito, updatePerito, listPeritos } from '@/features/peritos/actions';
import { createColaborador, updateColaborador, listColaboradores } from '@/features/colaboradores/actions';
import { createPericia, listPericias } from '@/features/pericias/actions';
import { parseColunaPericia, mapSituacao } from './lib/pericia-parser';
import { parseDataCelula, parseHoraCelula } from './lib/date-parsing';
import { mapJaTrabalhamos, mapRelacao, mapResultados } from './lib/perito-colaborador-parser';
import { encontrarIndiceColuna, encontrarLinhaComTexto } from './lib/header-lookup';
import type {
  NaoProcessada,
  PericiaPreviewRow,
  PreviewImportacaoPericiasResult,
  RelatorioImportacaoPericias,
  ColaboradorPreviewRow,
  PeritoPreviewRow,
  PreviewImportacaoPeritosColaboradoresResult,
  RelatorioImportacaoPeritosColaboradores,
} from './types';

const COLUNAS_PERICIA_ACEITAS: Record<string, string[]> = {
  pericia: ['PERÍCIA', 'PERICIA'],
  data: ['DATA'],
  hora: ['HORA'],
  local: ['LOCAL'],
  perito: ['PERITO'],
  campo: ['CAMPO'],
  situacao: ['SITUAÇÃO', 'SITUACAO'],
  obs: ['OBS', 'OBS.', 'OBSERVAÇÕES', 'OBSERVACOES'],
  escritorios: ['ESCRITÓRIOS', 'ESCRITORIOS', 'ESCRITÓRIO', 'ESCRITORIO'],
};

function textoCelula(row: ExcelJS.Row, indice: number | null): string {
  if (indice === null) return '';
  const value = row.getCell(indice).value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String((value as { text: unknown }).text ?? '');
  return String(value);
}

async function resolverMunicipio(nomeCidade: string): Promise<{ id: number; nome: string; uf: string } | null> {
  if (!nomeCidade.trim()) return null;
  const candidatos = await searchMunicipios(nomeCidade);
  const exatos = candidatos.filter((m) => normalizeForSearch(m.nome) === normalizeForSearch(nomeCidade));
  if (exatos.length === 0) return null;
  if (exatos.length === 1) return exatos[0];
  return exatos.find((m) => m.uf === 'MG') ?? exatos[0];
}

export async function previewImportacaoPericias(fileBuffer: ArrayBuffer): Promise<PreviewImportacaoPericiasResult> {
  await requireRole(['admin', 'gerencia']);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { linhas: [], naoProcessadas: [] };

  const [peritos, colaboradores, processos, periciasExistentes] = await Promise.all([
    listPeritos(), listColaboradores(), listProcessos(), listPericias(),
  ]);

  const headerRow = worksheet.getRow(1);
  const indices = Object.fromEntries(
    Object.entries(COLUNAS_PERICIA_ACEITAS).map(([chave, nomes]) => [chave, encontrarIndiceColuna(headerRow, nomes)])
  ) as Record<keyof typeof COLUNAS_PERICIA_ACEITAS, number | null>;

  const linhas: PericiaPreviewRow[] = [];
  const naoProcessadas: NaoProcessada[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const textoPericia = textoCelula(row, indices.pericia);
    if (!textoPericia.trim()) continue;

    const parseado = parseColunaPericia(textoPericia);
    if (!parseado) {
      naoProcessadas.push({
        linhaOriginal: rowNumber, texto: textoPericia,
        motivo: 'não foi possível identificar o número do processo',
      });
      continue;
    }

    const motivos: string[] = [];

    const processoExistente = processos.find(
      (p) => normalizeForSearch(p.numero) === normalizeForSearch(parseado.numeroProcesso)
    );

    const nomeCidade = textoCelula(row, indices.local);
    const municipio = await resolverMunicipio(nomeCidade);
    if (!municipio) motivos.push('município não encontrado');

    const nomePerito = textoCelula(row, indices.perito);
    if (!nomePerito.trim()) motivos.push('perito não informado');
    const peritoExistente = nomePerito.trim()
      ? peritos.find((p) => normalizeForSearch(p.nome) === normalizeForSearch(nomePerito))
      : undefined;

    const nomeColaborador = textoCelula(row, indices.campo);
    const colaboradorExistente = nomeColaborador.trim()
      ? colaboradores.find((c) => normalizeForSearch(c.nome) === normalizeForSearch(nomeColaborador))
      : undefined;

    const { situacao, reconhecida } = mapSituacao(textoCelula(row, indices.situacao));
    if (!reconhecida) motivos.push('situação não reconhecida');

    const dataAgendada = parseDataCelula(indices.data !== null ? row.getCell(indices.data).value : null);
    const horaAgendada = parseHoraCelula(indices.hora !== null ? row.getCell(indices.hora).value : null);
    const observacoesTexto = textoCelula(row, indices.obs);
    const observacoes = observacoesTexto.trim() || null;
    const escritorio = textoCelula(row, indices.escritorios).trim();

    const duplicada = periciasExistentes.some((p) =>
      normalizeForSearch(p.processo.numero) === normalizeForSearch(parseado.numeroProcesso) &&
      p.dataAgendada === dataAgendada &&
      p.horaAgendada === horaAgendada &&
      normalizeForSearch(p.perito.nome) === normalizeForSearch(nomePerito) &&
      normalizeForSearch(p.colaborador?.nome ?? '') === normalizeForSearch(nomeColaborador) &&
      (p.observacoes ?? '') === (observacoes ?? '')
    );

    linhas.push({
      linhaOriginal: rowNumber,
      status: duplicada ? 'duplicada' : motivos.length > 0 ? 'atencao' : 'ok',
      motivo: duplicada ? 'perícia já importada anteriormente' : motivos[0] ?? null,
      processoNumero: parseado.numeroProcesso,
      processoAutor: parseado.autor,
      processoReu: parseado.reu,
      processoEscritorio: escritorio,
      processoIdExistente: processoExistente?.id ?? null,
      dataAgendada,
      horaAgendada,
      municipioId: municipio?.id ?? null,
      municipioNome: municipio?.nome ?? nomeCidade,
      municipioUf: municipio?.uf ?? '',
      peritoNome: nomePerito,
      peritoIdExistente: peritoExistente?.id ?? null,
      colaboradorNome: nomeColaborador,
      colaboradorIdExistente: colaboradorExistente?.id ?? null,
      situacao,
      observacoes,
    });
  }

  return { linhas, naoProcessadas };
}

export async function confirmarImportacaoPericias(linhas: PericiaPreviewRow[]): Promise<RelatorioImportacaoPericias> {
  await requireRole(['admin', 'gerencia']);

  const periciasAtuais = await listPericias();
  const periciasCriadasNesteLote: Array<{
    processo: { numero: string };
    dataAgendada: string | null;
    horaAgendada: string | null;
    perito: { nome: string };
    colaborador: { nome: string } | null;
    observacoes: string | null;
  }> = [];

  const processosCriadosNesteLote = new Map<string, number>();
  const peritosCriadosNesteLote = new Map<string, number>();
  const colaboradoresCriadosNesteLote = new Map<string, number>();

  const relatorio: RelatorioImportacaoPericias = {
    processosCriados: 0, processosAtualizados: 0, periciasCriadas: 0,
    peritosCriados: 0, colaboradoresCriados: 0, puladasPorDuplicidade: 0,
  };

  for (const linha of linhas) {
    if (linha.status === 'duplicada') {
      relatorio.puladasPorDuplicidade++;
      continue;
    }

    const jaExiste = [...periciasAtuais, ...periciasCriadasNesteLote].some((p) =>
      normalizeForSearch(p.processo.numero) === normalizeForSearch(linha.processoNumero) &&
      p.dataAgendada === linha.dataAgendada &&
      p.horaAgendada === linha.horaAgendada &&
      normalizeForSearch(p.perito.nome) === normalizeForSearch(linha.peritoNome) &&
      normalizeForSearch(p.colaborador?.nome ?? '') === normalizeForSearch(linha.colaboradorNome) &&
      (p.observacoes ?? '') === (linha.observacoes ?? '')
    );
    if (jaExiste) {
      relatorio.puladasPorDuplicidade++;
      continue;
    }

    let processoId = linha.processoIdExistente;
    if (processoId) {
      const resultado = await updateProcesso(processoId, {
        numero: linha.processoNumero, autor: linha.processoAutor, reu: linha.processoReu, escritorio: linha.processoEscritorio,
      });
      if (resultado.success) relatorio.processosAtualizados++;
    } else {
      const chaveProcesso = normalizeForSearch(linha.processoNumero);
      processoId = processosCriadosNesteLote.get(chaveProcesso) ?? null;
      if (!processoId) {
        const resultado = await createProcesso({
          numero: linha.processoNumero, autor: linha.processoAutor, reu: linha.processoReu, escritorio: linha.processoEscritorio,
        });
        if (!resultado.success) continue;
        processoId = resultado.data.id;
        processosCriadosNesteLote.set(chaveProcesso, processoId);
        relatorio.processosCriados++;
      }
    }

    let peritoId = linha.peritoIdExistente;
    if (!peritoId && linha.peritoNome.trim()) {
      const chave = normalizeForSearch(linha.peritoNome);
      peritoId = peritosCriadosNesteLote.get(chave) ?? null;
      if (!peritoId) {
        const resultado = await createPerito({
          nome: linha.peritoNome, contato: '', formacao: '', crea: '', documento: '',
          jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial',
        });
        if (resultado.success) {
          peritoId = resultado.data.id;
          peritosCriadosNesteLote.set(chave, peritoId);
          relatorio.peritosCriados++;
        }
      }
    }
    if (!peritoId) continue;

    let colaboradorId = linha.colaboradorIdExistente;
    if (!colaboradorId && linha.colaboradorNome.trim()) {
      const chave = normalizeForSearch(linha.colaboradorNome);
      colaboradorId = colaboradoresCriadosNesteLote.get(chave) ?? null;
      if (!colaboradorId) {
        const resultado = await createColaborador({ nome: linha.colaboradorNome, contato: '', formacao: '' });
        if (resultado.success) {
          colaboradorId = resultado.data.id;
          colaboradoresCriadosNesteLote.set(chave, colaboradorId);
          relatorio.colaboradoresCriados++;
        }
      }
    }

    const resultadoPericia = await createPericia({
      processoId,
      municipioId: linha.municipioId as number,
      peritoId,
      colaboradorId: colaboradorId ?? null,
      dataAgendada: linha.dataAgendada,
      horaAgendada: linha.horaAgendada,
      situacao: linha.situacao,
      observacoes: linha.observacoes,
    });
    if (resultadoPericia.success) {
      relatorio.periciasCriadas++;
      periciasCriadasNesteLote.push({
        processo: { numero: linha.processoNumero },
        dataAgendada: linha.dataAgendada,
        horaAgendada: linha.horaAgendada,
        perito: { nome: linha.peritoNome },
        colaborador: linha.colaboradorNome ? { nome: linha.colaboradorNome } : null,
        observacoes: linha.observacoes,
      });
    }
  }

  return relatorio;
}

const COLUNAS_COLABORADOR_ACEITAS: Record<string, string[]> = {
  nome: ['COLABORADORES ÉTICA', 'COLABORADORES ETICA', 'COLABORADOR'],
  contato: ['CONTATO'],
};

const COLUNAS_PERITO_ACEITAS: Record<string, string[]> = {
  nome: ['PERITO'],
  contato: ['CONTATO'],
  formacao: ['FORMAÇÃO', 'FORMACAO'],
  crea: ['CREA'],
  documento: ['CPF'],
  jaTrabalhamos: ['JÁ TRABALHAMOS?', 'JA TRABALHAMOS?', 'JÁ TRABALHAMOS', 'JA TRABALHAMOS'],
  relacao: ['RELAÇÃO', 'RELACAO'],
  resultados: ['RESULTADOS'],
};

export async function previewImportacaoPeritosColaboradores(
  fileBuffer: ArrayBuffer
): Promise<PreviewImportacaoPeritosColaboradoresResult> {
  await requireRole(['admin', 'gerencia']);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { colaboradores: [], peritos: [], naoProcessadas: [] };

  const linhaPerito = encontrarLinhaComTexto(worksheet, 'PERITO');
  if (linhaPerito === null) {
    return {
      colaboradores: [], peritos: [],
      naoProcessadas: [{ linhaOriginal: 0, texto: '', motivo: 'não foi possível encontrar o cabeçalho "PERITO" na planilha' }],
    };
  }

  const [peritosAtuais, colaboradoresAtuais] = await Promise.all([listPeritos(), listColaboradores()]);

  const headerColaboradorRow = worksheet.getRow(1);
  const indicesColaborador = Object.fromEntries(
    Object.entries(COLUNAS_COLABORADOR_ACEITAS).map(([chave, nomes]) => [chave, encontrarIndiceColuna(headerColaboradorRow, nomes)])
  ) as Record<keyof typeof COLUNAS_COLABORADOR_ACEITAS, number | null>;

  const colaboradores: ColaboradorPreviewRow[] = [];
  for (let rowNumber = 2; rowNumber < linhaPerito; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const nome = textoCelula(row, indicesColaborador.nome);
    if (!nome.trim()) continue;
    const contato = textoCelula(row, indicesColaborador.contato);
    const existente = colaboradoresAtuais.find((c) => normalizeForSearch(c.nome) === normalizeForSearch(nome));
    colaboradores.push({
      linhaOriginal: rowNumber, status: 'ok', motivo: null, nome, contato, idExistente: existente?.id ?? null,
    });
  }

  const headerPeritoRow = worksheet.getRow(linhaPerito);
  const indicesPerito = Object.fromEntries(
    Object.entries(COLUNAS_PERITO_ACEITAS).map(([chave, nomes]) => [chave, encontrarIndiceColuna(headerPeritoRow, nomes)])
  ) as Record<keyof typeof COLUNAS_PERITO_ACEITAS, number | null>;

  const peritos: PeritoPreviewRow[] = [];
  for (let rowNumber = linhaPerito + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const nome = textoCelula(row, indicesPerito.nome);
    if (!nome.trim()) continue;

    const motivos: string[] = [];
    const { relacao, reconhecida: relacaoReconhecida } = mapRelacao(textoCelula(row, indicesPerito.relacao));
    if (!relacaoReconhecida) motivos.push('relação não reconhecida');
    const { resultados, reconhecida: resultadosReconhecida } = mapResultados(textoCelula(row, indicesPerito.resultados));
    if (!resultadosReconhecida) motivos.push('resultados não reconhecido');

    const existente = peritosAtuais.find((p) => normalizeForSearch(p.nome) === normalizeForSearch(nome));
    peritos.push({
      linhaOriginal: rowNumber,
      status: motivos.length > 0 ? 'atencao' : 'ok',
      motivo: motivos[0] ?? null,
      nome,
      contato: textoCelula(row, indicesPerito.contato),
      formacao: textoCelula(row, indicesPerito.formacao),
      crea: textoCelula(row, indicesPerito.crea),
      documento: textoCelula(row, indicesPerito.documento),
      jaTrabalhamos: mapJaTrabalhamos(textoCelula(row, indicesPerito.jaTrabalhamos)),
      relacao,
      resultados,
      idExistente: existente?.id ?? null,
    });
  }

  return { colaboradores, peritos, naoProcessadas: [] };
}

export async function confirmarImportacaoPeritosColaboradores(
  colaboradores: ColaboradorPreviewRow[],
  peritos: PeritoPreviewRow[]
): Promise<RelatorioImportacaoPeritosColaboradores> {
  await requireRole(['admin', 'gerencia']);

  const [colaboradoresAtuais, peritosAtuais] = await Promise.all([listColaboradores(), listPeritos()]);
  const colaboradoresCriadosNesteLote = new Map<string, number>();
  const peritosCriadosNesteLote = new Map<string, number>();

  const relatorio: RelatorioImportacaoPeritosColaboradores = {
    peritosCriados: 0, peritosAtualizados: 0, colaboradoresCriados: 0, colaboradoresAtualizados: 0,
  };

  for (const linha of colaboradores) {
    const input = { nome: linha.nome, contato: linha.contato, formacao: '' };
    const chave = normalizeForSearch(linha.nome);
    const existente = colaboradoresAtuais.find((c) => normalizeForSearch(c.nome) === chave);
    const idResolvido = existente?.id ?? linha.idExistente ?? colaboradoresCriadosNesteLote.get(chave) ?? null;

    if (idResolvido) {
      const resultado = await updateColaborador(idResolvido, input);
      if (resultado.success) relatorio.colaboradoresAtualizados++;
    } else {
      const resultado = await createColaborador(input);
      if (resultado.success) {
        colaboradoresCriadosNesteLote.set(chave, resultado.data.id);
        relatorio.colaboradoresCriados++;
      }
    }
  }

  for (const linha of peritos) {
    const input = {
      nome: linha.nome, contato: linha.contato, formacao: linha.formacao, crea: linha.crea,
      documento: linha.documento, jaTrabalhamos: linha.jaTrabalhamos, relacao: linha.relacao, resultados: linha.resultados,
    };
    const chave = normalizeForSearch(linha.nome);
    const existente = peritosAtuais.find((p) => normalizeForSearch(p.nome) === chave);
    const idResolvido = existente?.id ?? linha.idExistente ?? peritosCriadosNesteLote.get(chave) ?? null;

    if (idResolvido) {
      const resultado = await updatePerito(idResolvido, input);
      if (resultado.success) relatorio.peritosAtualizados++;
    } else {
      const resultado = await createPerito(input);
      if (resultado.success) {
        peritosCriadosNesteLote.set(chave, resultado.data.id);
        relatorio.peritosCriados++;
      }
    }
  }

  return relatorio;
}
