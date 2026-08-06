'use server';

import ExcelJS from 'exceljs';
import { requireRole } from '@/features/auth/guards';
import { findMunicipiosPorNomeExato } from '@/lib/ibge/client';
import { normalizeForSearch } from '@/lib/search';
import { createProcesso, updateProcesso, listProcessos } from '@/features/processos/actions';
import { createPerito, updatePerito, listPeritos } from '@/features/peritos/actions';
import { createColaborador, updateColaborador, listColaboradores } from '@/features/colaboradores/actions';
import { createPericia, listPericias } from '@/features/pericias/actions';
import { upsertMunicipio } from '@/features/municipios/actions';
import { parseColunaPericia, mapSituacao } from './lib/pericia-parser';
import { parseDataCelula, parseHoraCelula } from './lib/date-parsing';
import { mapJaTrabalhamos, mapRelacao, mapResultados } from './lib/perito-colaborador-parser';
import { encontrarIndiceColuna, encontrarLinhaComTexto, encontrarLinhaComColuna } from './lib/header-lookup';
import { textoDaCelula } from './lib/cell-text';
import { chaveDeLote } from './lib/resolver-id';
import { mapComConcorrencia } from './lib/concurrency';
import { nomeSuspeito } from './lib/nome-suspeito';
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
  return textoDaCelula(row.getCell(indice).value);
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error && erro.message ? erro.message : 'erro inesperado';
}

async function resolverMunicipio(nomeCidade: string): Promise<{ id: number; nome: string; uf: string } | null> {
  if (!nomeCidade.trim()) return null;
  const exatos = await findMunicipiosPorNomeExato(nomeCidade);
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

  // The header row is located by content, not assumed to be row 1, so a title
  // row above it (e.g. "VALE BRUMADINHO") doesn't break column lookup.
  const linhaCabecalho = encontrarLinhaComColuna(worksheet, COLUNAS_PERICIA_ACEITAS.pericia);
  if (linhaCabecalho === null) {
    return {
      linhas: [],
      naoProcessadas: [
        {
          linhaOriginal: 1,
          texto: '',
          motivo: 'não foi possível encontrar a coluna "PERÍCIA" na planilha',
        },
      ],
    };
  }

  const headerRow = worksheet.getRow(linhaCabecalho);
  const indices = Object.fromEntries(
    Object.entries(COLUNAS_PERICIA_ACEITAS).map(([chave, nomes]) => [chave, encontrarIndiceColuna(headerRow, nomes)])
  ) as Record<keyof typeof COLUNAS_PERICIA_ACEITAS, number | null>;

  const [peritos, colaboradores, processos, periciasExistentes] = await Promise.all([
    listPeritos(), listColaboradores(), listProcessos(), listPericias(),
  ]);
  const chavesExistentes = new Set(periciasExistentes.map((p) => chavePericia({
    numero: p.processo.numero, dataAgendada: p.dataAgendada, horaAgendada: p.horaAgendada,
    peritoNome: p.perito.nome, colaboradorNome: p.colaborador?.nome ?? '', observacoes: p.observacoes,
  })));

  const linhas: PericiaPreviewRow[] = [];
  const naoProcessadas: NaoProcessada[] = [];

  for (let rowNumber = linhaCabecalho + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
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
    // A brand-new "name" that's a single character is almost always a
    // parsing artifact (a stray initial), not a real person — flag it apart
    // from a plain "atencao" and refuse to auto-create it (see confirm).
    // Reusing an *existing* colaborador is unaffected, however short its name.
    const colaboradorNomeSuspeito = !colaboradorExistente && nomeColaborador.trim() !== '' && nomeSuspeito(nomeColaborador);

    const { situacao, reconhecida } = mapSituacao(textoCelula(row, indices.situacao));
    if (!reconhecida) motivos.push('situação não reconhecida');

    const dataAgendada = parseDataCelula(indices.data !== null ? row.getCell(indices.data).value : null);
    const horaAgendada = parseHoraCelula(indices.hora !== null ? row.getCell(indices.hora).value : null);
    const observacoesTexto = textoCelula(row, indices.obs);
    const observacoes = observacoesTexto.trim() || null;
    const escritorio = textoCelula(row, indices.escritorios).trim();

    const duplicada = chavesExistentes.has(chavePericia({
      numero: parseado.numeroProcesso, dataAgendada, horaAgendada,
      peritoNome: nomePerito, colaboradorNome: nomeColaborador, observacoes,
    }));

    linhas.push({
      linhaOriginal: rowNumber,
      status: duplicada ? 'duplicada' : colaboradorNomeSuspeito ? 'suspeito' : motivos.length > 0 ? 'atencao' : 'ok',
      motivo: duplicada
        ? 'perícia já importada anteriormente'
        : colaboradorNomeSuspeito
          ? 'nome de colaborador muito curto — confirme se está correto'
          : motivos[0] ?? null,
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

// A sequential for-loop over every row (each doing up to 4 DB round trips)
// took hours on a real ~1700-row sheet. Rows overwhelmingly reference a much
// smaller set of *distinct* processos/peritos/colaboradores/municípios, so
// each entity type is resolved exactly once per distinct value — concurrently,
// bounded by this limit — and only then are the (now cheap) perícia rows
// created, also concurrently.
const CONCORRENCIA_IMPORTACAO = 20;

type Resolucao<T> = { id: T } | { erro: string };

function chavePericia(dados: {
  numero: string;
  dataAgendada: string | null;
  horaAgendada: string | null;
  peritoNome: string;
  colaboradorNome: string;
  observacoes: string | null;
}): string {
  return JSON.stringify([
    normalizeForSearch(dados.numero), dados.dataAgendada,
    // The DB's `time` column round-trips as "HH:MM:SS" (via listPericias),
    // while a freshly parsed sheet cell is "HH:MM" (parseHoraCelula) — left
    // uncompared, EVERY row would look "new" against its own existing
    // record, and a re-import would duplicate the whole sheet. Truncate to
    // "HH:MM" so both sources compare equal regardless of which produced them.
    dados.horaAgendada?.slice(0, 5) ?? null,
    normalizeForSearch(dados.peritoNome), normalizeForSearch(dados.colaboradorNome),
    dados.observacoes ?? '',
  ]);
}

export async function confirmarImportacaoPericias(linhas: PericiaPreviewRow[]): Promise<RelatorioImportacaoPericias> {
  await requireRole(['admin', 'gerencia']);

  // Fresh reads: the preview rows come back from the client, where they may be
  // stale (the DB moved on since the upload) or hand-edited, so their
  // *IdExistente values are never trusted for deciding create-vs-update.
  const [periciasAtuais, processosAtuais, peritosAtuais, colaboradoresAtuais] = await Promise.all([
    listPericias(), listProcessos(), listPeritos(), listColaboradores(),
  ]);

  const relatorio: RelatorioImportacaoPericias = {
    processosCriados: 0, processosAtualizados: 0, periciasCriadas: 0,
    peritosCriados: 0, colaboradoresCriados: 0, puladasPorDuplicidade: 0,
    linhasComErro: [],
  };
  function registrarErro(linha: PericiaPreviewRow, erro: string) {
    relatorio.linhasComErro.push({ linhaOriginal: linha.linhaOriginal, erro });
  }

  // --- Phase 1 (sync): duplicidade (against the DB and within this sheet) and
  // município-ausente triage. A row identical to another row earlier in the
  // same sheet is treated as a duplicate up front — regardless of whether the
  // earlier row's write ultimately succeeds — since it describes the same
  // real-world perícia.
  const chavesExistentes = new Set(periciasAtuais.map((p) => chavePericia({
    numero: p.processo.numero, dataAgendada: p.dataAgendada, horaAgendada: p.horaAgendada,
    peritoNome: p.perito.nome, colaboradorNome: p.colaborador?.nome ?? '', observacoes: p.observacoes,
  })));
  const chavesReservadasNesteLote = new Set<string>();
  const candidatas: PericiaPreviewRow[] = [];
  for (const linha of linhas) {
    if (linha.status === 'duplicada') {
      relatorio.puladasPorDuplicidade++;
      continue;
    }
    const chave = chavePericia({
      numero: linha.processoNumero, dataAgendada: linha.dataAgendada, horaAgendada: linha.horaAgendada,
      peritoNome: linha.peritoNome, colaboradorNome: linha.colaboradorNome, observacoes: linha.observacoes,
    });
    if (chavesExistentes.has(chave) || chavesReservadasNesteLote.has(chave)) {
      relatorio.puladasPorDuplicidade++;
      continue;
    }
    chavesReservadasNesteLote.add(chave);
    if (linha.municipioId === null) {
      registrarErro(linha, 'município não resolvido');
      continue;
    }
    candidatas.push(linha);
  }

  // --- Phase 2 (concurrent): upsert every distinct município this batch needs.
  // municipios is a local table pericias.municipio_id points at; a município
  // resolved from the IBGE API has to land there before the FK will accept it.
  const municipioIds = [...new Set(candidatas.map((l) => l.municipioId as number))];
  const municipiosResolvidos = new Map<number, true | { erro: string }>();
  await mapComConcorrencia(municipioIds, CONCORRENCIA_IMPORTACAO, async (municipioId) => {
    const amostra = candidatas.find((l) => l.municipioId === municipioId)!;
    try {
      await upsertMunicipio({ id: municipioId, nome: amostra.municipioNome, uf: amostra.municipioUf });
      municipiosResolvidos.set(municipioId, true);
    } catch (erro) {
      municipiosResolvidos.set(municipioId, { erro: `falha ao salvar município: ${mensagemDeErro(erro)}` });
    }
  });

  // --- Phase 3 (sync): drop rows whose município failed, then collect the
  // distinct processos the survivors need.
  const linhasComMunicipioOk: PericiaPreviewRow[] = [];
  for (const linha of candidatas) {
    const resolucao = municipiosResolvidos.get(linha.municipioId as number)!;
    if (resolucao !== true) {
      registrarErro(linha, resolucao.erro);
      continue;
    }
    linhasComMunicipioOk.push(linha);
  }

  const processoPorChave = new Map<string, PericiaPreviewRow>();
  for (const linha of linhasComMunicipioOk) {
    const chave = chaveDeLote(linha.processoNumero);
    if (!processoPorChave.has(chave)) processoPorChave.set(chave, linha);
  }

  // --- Phase 4 (concurrent): resolve every distinct processo — update if it
  // already exists (the sheet's data always wins), create otherwise.
  const processosResolvidos = new Map<string, Resolucao<number>>();
  await mapComConcorrencia([...processoPorChave.entries()], CONCORRENCIA_IMPORTACAO, async ([chave, amostra]) => {
    const existente = processosAtuais.find((p) => normalizeForSearch(p.numero) === chave);
    const dados = {
      numero: amostra.processoNumero, autor: amostra.processoAutor,
      reu: amostra.processoReu, escritorio: amostra.processoEscritorio,
    };
    if (existente) {
      const resultado = await updateProcesso(existente.id, dados);
      if (!resultado.success) {
        processosResolvidos.set(chave, { erro: `falha ao atualizar processo: ${resultado.error}` });
        return;
      }
      relatorio.processosAtualizados++;
      processosResolvidos.set(chave, { id: existente.id });
      return;
    }
    const resultado = await createProcesso(dados);
    if (!resultado.success) {
      processosResolvidos.set(chave, { erro: `falha ao criar processo: ${resultado.error}` });
      return;
    }
    relatorio.processosCriados++;
    processosResolvidos.set(chave, { id: resultado.data.id });
  });

  // --- Phase 5 (concurrent): same for peritos — names already in the cadastro
  // resolve synchronously (no write); only genuinely new names are created.
  const peritoIdPorChave = new Map<string, number>();
  const peritoNovoPorChave = new Map<string, PericiaPreviewRow>();
  for (const linha of linhasComMunicipioOk) {
    if (!linha.peritoNome.trim()) continue;
    const chave = chaveDeLote(linha.peritoNome);
    if (peritoIdPorChave.has(chave) || peritoNovoPorChave.has(chave)) continue;
    const existente = peritosAtuais.find((p) => normalizeForSearch(p.nome) === chave);
    if (existente) peritoIdPorChave.set(chave, existente.id);
    else peritoNovoPorChave.set(chave, linha);
  }
  const peritosNovosResolvidos = new Map<string, Resolucao<number>>();
  await mapComConcorrencia([...peritoNovoPorChave.entries()], CONCORRENCIA_IMPORTACAO, async ([chave, amostra]) => {
    const resultado = await createPerito({
      nome: amostra.peritoNome, contato: '', formacao: '', crea: '', documento: '',
      jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial',
    });
    if (!resultado.success) {
      peritosNovosResolvidos.set(chave, { erro: `falha ao criar perito: ${resultado.error}` });
      return;
    }
    relatorio.peritosCriados++;
    peritosNovosResolvidos.set(chave, { id: resultado.data.id });
  });

  // --- Phase 6 (concurrent): same for colaboradores — optional, so a blank
  // name is simply "no colaborador," never an error.
  const colaboradorIdPorChave = new Map<string, number>();
  const colaboradorNovoPorChave = new Map<string, PericiaPreviewRow>();
  for (const linha of linhasComMunicipioOk) {
    if (!linha.colaboradorNome.trim()) continue;
    const chave = chaveDeLote(linha.colaboradorNome);
    if (colaboradorIdPorChave.has(chave) || colaboradorNovoPorChave.has(chave)) continue;
    const existente = colaboradoresAtuais.find((c) => normalizeForSearch(c.nome) === chave);
    if (existente) colaboradorIdPorChave.set(chave, existente.id);
    else colaboradorNovoPorChave.set(chave, linha);
  }
  const colaboradoresNovosResolvidos = new Map<string, Resolucao<number>>();
  await mapComConcorrencia([...colaboradorNovoPorChave.entries()], CONCORRENCIA_IMPORTACAO, async ([chave, amostra]) => {
    // A single-character "name" is almost always a parsing artifact, not a
    // real person — never auto-create a cadastro record from it. The row is
    // already flagged 'suspeito' at preview time; this is the hard backstop
    // in case it reaches confirm unedited.
    if (nomeSuspeito(amostra.colaboradorNome)) {
      colaboradoresNovosResolvidos.set(chave, {
        erro: `nome de colaborador "${amostra.colaboradorNome}" muito curto para cadastrar — corrija antes de confirmar`,
      });
      return;
    }
    const resultado = await createColaborador({ nome: amostra.colaboradorNome, contato: '', formacao: '', email: '' });
    if (!resultado.success) {
      colaboradoresNovosResolvidos.set(chave, { erro: `falha ao criar colaborador: ${resultado.error}` });
      return;
    }
    relatorio.colaboradoresCriados++;
    colaboradoresNovosResolvidos.set(chave, { id: resultado.data.id });
  });

  // --- Phase 7: assemble each row's perícia payload (same first-failure-wins
  // order as before: processo, then perito, then colaborador), then create
  // every ready perícia concurrently.
  type PericiaPronta = { linha: PericiaPreviewRow; processoId: number; peritoId: number; colaboradorId: number | null };
  const prontas: PericiaPronta[] = [];

  for (const linha of linhasComMunicipioOk) {
    const resolProcesso = processosResolvidos.get(chaveDeLote(linha.processoNumero))!;
    if ('erro' in resolProcesso) {
      registrarErro(linha, resolProcesso.erro);
      continue;
    }

    let peritoId: number | null = null;
    if (linha.peritoNome.trim()) {
      const chave = chaveDeLote(linha.peritoNome);
      peritoId = peritoIdPorChave.get(chave) ?? null;
      if (peritoId === null) {
        const resolPerito = peritosNovosResolvidos.get(chave);
        if (resolPerito && 'erro' in resolPerito) {
          registrarErro(linha, resolPerito.erro);
          continue;
        }
        peritoId = resolPerito ? resolPerito.id : null;
      }
    }
    if (!peritoId) {
      registrarErro(linha, 'perito não informado');
      continue;
    }

    let colaboradorId: number | null = null;
    if (linha.colaboradorNome.trim()) {
      const chave = chaveDeLote(linha.colaboradorNome);
      colaboradorId = colaboradorIdPorChave.get(chave) ?? null;
      if (colaboradorId === null) {
        const resolColaborador = colaboradoresNovosResolvidos.get(chave);
        if (resolColaborador && 'erro' in resolColaborador) {
          registrarErro(linha, resolColaborador.erro);
          continue;
        }
        colaboradorId = resolColaborador ? resolColaborador.id : null;
      }
    }

    prontas.push({ linha, processoId: resolProcesso.id, peritoId, colaboradorId });
  }

  await mapComConcorrencia(prontas, CONCORRENCIA_IMPORTACAO, async ({ linha, processoId, peritoId, colaboradorId }) => {
    const resultado = await createPericia({
      processoId,
      municipioId: linha.municipioId as number,
      peritoId,
      colaboradorId,
      dataAgendada: linha.dataAgendada,
      horaAgendada: linha.horaAgendada,
      situacao: linha.situacao,
      observacoes: linha.observacoes,
    });
    if (!resultado.success) {
      registrarErro(linha, `falha ao criar perícia: ${resultado.error}`);
      return;
    }
    relatorio.periciasCriadas++;
  });

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

  // The colaborador header isn't necessarily on row 1 — a title row (or blank
  // rows) can sit above it, same as the perícia sheet's header — so it must be
  // located dynamically instead of assumed, or every colaborador row silently
  // fails to match and none get imported.
  const linhaHeaderColaborador = encontrarLinhaComColuna(worksheet, COLUNAS_COLABORADOR_ACEITAS.nome);
  const colaboradores: ColaboradorPreviewRow[] = [];
  if (linhaHeaderColaborador !== null && linhaHeaderColaborador < linhaPerito) {
    const headerColaboradorRow = worksheet.getRow(linhaHeaderColaborador);
    const indicesColaborador = Object.fromEntries(
      Object.entries(COLUNAS_COLABORADOR_ACEITAS).map(([chave, nomes]) => [chave, encontrarIndiceColuna(headerColaboradorRow, nomes)])
    ) as Record<keyof typeof COLUNAS_COLABORADOR_ACEITAS, number | null>;

    for (let rowNumber = linhaHeaderColaborador + 1; rowNumber < linhaPerito; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const nome = textoCelula(row, indicesColaborador.nome);
      if (!nome.trim()) continue;
      const contato = textoCelula(row, indicesColaborador.contato);
      const existente = colaboradoresAtuais.find((c) => normalizeForSearch(c.nome) === normalizeForSearch(nome));
      colaboradores.push({
        linhaOriginal: rowNumber, status: 'ok', motivo: null, nome, contato, idExistente: existente?.id ?? null,
      });
    }
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

  const relatorio: RelatorioImportacaoPeritosColaboradores = {
    peritosCriados: 0, peritosAtualizados: 0, colaboradoresCriados: 0, colaboradoresAtualizados: 0,
    linhasComErro: [],
  };

  // Rows sharing a name must stay sequential relative to each other (the first
  // creates, the rest update using the id it produced), but distinct names are
  // fully independent — so group by name, then run the groups concurrently.
  function agruparPorNome<T extends { nome: string }>(linhas: T[]): Map<string, T[]> {
    const grupos = new Map<string, T[]>();
    for (const linha of linhas) {
      const chave = chaveDeLote(linha.nome);
      const grupo = grupos.get(chave);
      if (grupo) grupo.push(linha);
      else grupos.set(chave, [linha]);
    }
    return grupos;
  }

  await mapComConcorrencia([...agruparPorNome(colaboradores).values()], CONCORRENCIA_IMPORTACAO, async (grupo) => {
    const existente = colaboradoresAtuais.find((c) => normalizeForSearch(c.nome) === chaveDeLote(grupo[0].nome));
    let idAtual = existente?.id ?? null;
    for (const linha of grupo) {
      // The Tab 2 sheet has no formação or e-mail columns for colaboradores,
      // so an update must carry the stored values through instead of blanking them.
      const input = {
        nome: linha.nome, contato: linha.contato,
        formacao: existente?.formacao ?? '', email: existente?.email ?? '',
      };
      if (idAtual) {
        const resultado = await updateColaborador(idAtual, input);
        if (resultado.success) relatorio.colaboradoresAtualizados++;
        else relatorio.linhasComErro.push({ linhaOriginal: linha.linhaOriginal, erro: `falha ao atualizar colaborador: ${resultado.error}` });
      } else {
        const resultado = await createColaborador(input);
        if (resultado.success) {
          idAtual = resultado.data.id;
          relatorio.colaboradoresCriados++;
        } else {
          relatorio.linhasComErro.push({ linhaOriginal: linha.linhaOriginal, erro: `falha ao criar colaborador: ${resultado.error}` });
        }
      }
    }
  });

  await mapComConcorrencia([...agruparPorNome(peritos).values()], CONCORRENCIA_IMPORTACAO, async (grupo) => {
    const existente = peritosAtuais.find((p) => normalizeForSearch(p.nome) === chaveDeLote(grupo[0].nome));
    let idAtual = existente?.id ?? null;
    for (const linha of grupo) {
      const input = {
        nome: linha.nome, contato: linha.contato, formacao: linha.formacao, crea: linha.crea,
        documento: linha.documento, jaTrabalhamos: linha.jaTrabalhamos, relacao: linha.relacao, resultados: linha.resultados,
      };
      if (idAtual) {
        const resultado = await updatePerito(idAtual, input);
        if (resultado.success) relatorio.peritosAtualizados++;
        else relatorio.linhasComErro.push({ linhaOriginal: linha.linhaOriginal, erro: `falha ao atualizar perito: ${resultado.error}` });
      } else {
        const resultado = await createPerito(input);
        if (resultado.success) {
          idAtual = resultado.data.id;
          relatorio.peritosCriados++;
        } else {
          relatorio.linhasComErro.push({ linhaOriginal: linha.linhaOriginal, erro: `falha ao criar perito: ${resultado.error}` });
        }
      }
    }
  });

  return relatorio;
}
