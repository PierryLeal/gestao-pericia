'use server';

import ExcelJS from 'exceljs';
import { requireRole } from '@/features/auth/guards';
import { findMunicipiosPorNomeExato } from '@/lib/ibge/client';
import { normalizeForSearch } from '@/lib/search';
import { createProcessoComPendencias, updateProcessoComPendencias, listProcessos } from '@/features/processos/actions';
import { createPerito, updatePerito, listPeritos } from '@/features/peritos/actions';
import { createColaborador, updateColaborador, listColaboradores } from '@/features/colaboradores/actions';
import { createPericiaComPendencias, listPericias } from '@/features/pericias/actions';
import { ERRO_COLABORADOR_CONFLITANTE } from '@/features/pericias/constants';
import { upsertMunicipio } from '@/features/municipios/actions';
import { parseColunaPericia, mapSituacao, splitColaboradorNomes } from './lib/pericia-parser';
import { parseDataCelula, parseHoraCelula } from './lib/date-parsing';
import { mapJaTrabalhamos, mapRelacao, mapResultados } from './lib/perito-colaborador-parser';
import { encontrarIndiceColuna, encontrarLinhaComTexto, encontrarLinhaComColuna } from './lib/header-lookup';
import { encontrarBlocosDeContrato } from './lib/blocos-contrato';
import { textoDaCelula } from './lib/cell-text';
import { chaveDeLote } from './lib/resolver-id';
import { mapComConcorrencia } from './lib/concurrency';
import { nomeSuspeito } from '@/lib/nome-suspeito';
import { detectarConflitosDeHorario, type LinhaParaConflito, type PericiaExistenteParaConflito } from './lib/conflito-horario';
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

const SIGLAS_UF = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

function escolherMelhorMatch(candidatos: { id: number; nome: string; uf: string }[]): { id: number; nome: string; uf: string } | null {
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];
  return candidatos.find((m) => m.uf === 'MG') ?? candidatos[0];
}

async function resolverMunicipio(nomeCidade: string): Promise<{ id: number; nome: string; uf: string } | null> {
  const trimmed = nomeCidade.trim();
  if (!trimmed) return null;

  const direto = escolherMelhorMatch(await findMunicipiosPorNomeExato(trimmed));
  if (direto) return direto;

  // The sheet's LOCAL column sometimes glues the UF onto the city name (e.g.
  // "ARAQUARI-SC") — an exact-name IBGE lookup never matches that as-is, so a
  // trailing "-UF"/" UF"/"/UF" gets stripped and re-tried, preferring a match
  // whose own uf agrees with the suffix (over just falling back to MG).
  const match = trimmed.match(/^(.+?)[\s/-]+([A-Za-z]{2})$/);
  if (match) {
    const [, cidade, siglaBruta] = match;
    const sigla = siglaBruta.toUpperCase();
    if (SIGLAS_UF.has(sigla)) {
      const candidatos = await findMunicipiosPorNomeExato(cidade);
      const comUfCorreta = candidatos.find((m) => m.uf === sigla);
      if (comUfCorreta) return comUfCorreta;
    }
  }

  return null;
}

export async function previewImportacaoPericias(fileBuffer: ArrayBuffer): Promise<PreviewImportacaoPericiasResult> {
  await requireRole(['admin', 'gerencia']);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { linhas: [], naoProcessadas: [] };

  // A sheet can group its rows into several blocks, each under its own
  // "contrato" banner (e.g. "VALE BRUMADINHO") immediately above its own
  // PERÍCIA/DATA/HORA/... header row — an older, single-block sheet with no
  // banner at all still comes back as one block with contrato: null.
  const blocos = encontrarBlocosDeContrato(worksheet, COLUNAS_PERICIA_ACEITAS.pericia);
  if (blocos.length === 0) {
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

  const [peritos, colaboradores, processos, periciasExistentes] = await Promise.all([
    listPeritos(), listColaboradores(), listProcessos(), listPericias(),
  ]);
  const chavesExistentes = new Set(periciasExistentes.map((p) => chavePericia({
    numero: p.processo?.numero ?? '', dataAgendada: p.dataAgendada, horaAgendada: p.horaAgendada,
    peritoNome: p.perito?.nome ?? '', colaboradorNomes: p.colaboradores.map((c) => c.nome), observacoes: p.observacoes,
  })));
  const existentesParaConflito: PericiaExistenteParaConflito[] = periciasExistentes.map((p) => ({
    processoNumero: p.processo?.numero ?? '', dataAgendada: p.dataAgendada, horaAgendada: p.horaAgendada,
    situacao: p.situacao, colaboradorNomes: p.colaboradores.map((c) => c.nome),
    peritoNome: p.perito?.nome ?? '', local: p.local,
  }));

  const linhas: PericiaPreviewRow[] = [];
  const linhasParaConflito: LinhaParaConflito[] = [];
  const naoProcessadas: NaoProcessada[] = [];

  for (const bloco of blocos) {
    const headerRow = worksheet.getRow(bloco.linhaCabecalho);
    const indices = Object.fromEntries(
      Object.entries(COLUNAS_PERICIA_ACEITAS).map(([chave, nomes]) => [chave, encontrarIndiceColuna(headerRow, nomes)])
    ) as Record<keyof typeof COLUNAS_PERICIA_ACEITAS, number | null>;

    for (let rowNumber = bloco.linhaCabecalho + 1; rowNumber <= bloco.linhaFim; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const textoPericia = textoCelula(row, indices.pericia);
      if (!textoPericia.trim()) continue;

      // A cell whose processo número couldn't be identified used to be dropped
      // into naoProcessadas entirely — no longer: it's still saved (without a
      // processo, to be linked manually later) so the row isn't lost, but its
      // número/autor/réu stay blank rather than polluting them with unparsed
      // text that could otherwise get created as a bogus processo downstream.
      const parseadoOriginal = parseColunaPericia(textoPericia);
      // No CNJ number and no " - " separator to split on (e.g. an internal file
      // code like "FC.02.01.055", not a lawsuit número at all) — the raw cell
      // text becomes the row's provisional "número" instead of staying blank.
      // A blank número is never deduped against anything (two unrelated blank
      // rows could otherwise look identical and wrongly merge), which meant
      // every one of these rows got recreated on every re-import of the same
      // sheet — confirmed against production: reimporting created 147+ extra
      // duplicate pericias for exactly this reason. The raw text is usually
      // distinct per row, so it lets normal dedup work instead.
      const parseado = parseadoOriginal ?? { autor: '', reu: '', numeroProcesso: textoPericia.trim() };

      const motivos: string[] = [];
      if (!parseadoOriginal) {
        motivos.push(`processo não identificado no texto "${textoPericia.trim()}" — usando o texto da célula como identificador provisório; edite o campo Processo manualmente`);
      }
      if (!parseado.autor.trim()) motivos.push('autor não identificado');

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

      // A perícia can list more than one colaborador, "/"-separated (e.g.
      // "Igor Navarro/Julio Cesar Mulatti").
      const nomeColaborador = textoCelula(row, indices.campo);
      const nomesColaboradores = splitColaboradorNomes(nomeColaborador);
      const colaboradorIdsExistentes: number[] = [];
      const nomesColaboradorSuspeitos: string[] = [];
      for (const nome of nomesColaboradores) {
        const existente = colaboradores.find((c) => normalizeForSearch(c.nome) === normalizeForSearch(nome));
        if (existente) {
          colaboradorIdsExistentes.push(existente.id);
          continue;
        }
        // A brand-new "name" that's a single character often turns out to be a
        // real colaborador's shorthand initial rather than a parsing artifact —
        // still created (see confirm), just flagged apart from a plain
        // "atencao" so the user notices and can rename/merge it later.
        // Reusing an *existing* colaborador is unaffected, however short its name.
        if (nomeSuspeito(nome)) nomesColaboradorSuspeitos.push(nome);
      }
      const colaboradorNomeSuspeito = nomesColaboradorSuspeitos.length > 0;

      const { situacao, reconhecida } = mapSituacao(textoCelula(row, indices.situacao));
      if (!reconhecida) motivos.push('situação não reconhecida');

      const dataAgendada = parseDataCelula(indices.data !== null ? row.getCell(indices.data).value : null);
      const horaAgendada = parseHoraCelula(indices.hora !== null ? row.getCell(indices.hora).value : null);
      const observacoesTexto = textoCelula(row, indices.obs);
      const observacoes = observacoesTexto.trim() || null;
      const escritorio = textoCelula(row, indices.escritorios).trim();

      // Without a real processo número, two unrelated blank rows would compare
      // equal and wrongly flag each other as duplicates — never dedupe them.
      const duplicada = parseado.numeroProcesso.trim() !== '' && chavesExistentes.has(chavePericia({
        numero: parseado.numeroProcesso, dataAgendada, horaAgendada,
        peritoNome: nomePerito, colaboradorNomes: nomesColaboradores, observacoes,
      }));

      const motivosCompletos = [
        ...motivos,
        ...nomesColaboradorSuspeitos.map((nome) => `nome de colaborador "${nome}" muito curto — será cadastrado assim mesmo, confirme se está correto`),
        ...(duplicada ? ['perícia já importada anteriormente'] : []),
      ];

      linhas.push({
        linhaOriginal: rowNumber,
        status: duplicada ? 'duplicada' : colaboradorNomeSuspeito ? 'suspeito' : motivos.length > 0 ? 'atencao' : 'ok',
        motivos: motivosCompletos,
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
        colaboradorIdsExistentes,
        situacao,
        observacoes,
        contrato: bloco.contrato,
      });
      linhasParaConflito.push({
        linhaOriginal: rowNumber, processoNumero: parseado.numeroProcesso, dataAgendada, horaAgendada,
        situacao, colaboradorNomes: nomesColaboradores,
        peritoNome: nomePerito, local: municipio?.nome ?? nomeCidade,
      });
    }
  }

  const conflitos = detectarConflitosDeHorario(linhasParaConflito, existentesParaConflito);
  for (const linha of linhas) {
    const conflitosDaLinha = conflitos.get(linha.linhaOriginal);
    if (!conflitosDaLinha || conflitosDaLinha.length === 0) continue;
    for (const conflito of conflitosDaLinha) {
      linha.motivos.push(
        conflito.vaiSerImportada
          ? `${conflito.colaboradorNome} já está escalado no mesmo horário para o processo ${conflito.processoConflitante} — esta linha será importada, a outra não`
          : `conflito de horário: ${conflito.colaboradorNome} já está escalado no mesmo horário para ${conflito.contraExistente ? 'a perícia existente do' : 'outra linha do'} processo ${conflito.processoConflitante} — esta linha não será importada`
      );
      // A losing row upgrades to "atencao" so its color reflects the risk;
      // a winning row is purely informational and keeps its original status.
      if (!conflito.vaiSerImportada && linha.status === 'ok') linha.status = 'atencao';
    }
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
  colaboradorNomes: string[];
  observacoes: string | null;
}): string {
  // Sorted so "Igor/Julio" and "Julio/Igor" (order doesn't carry meaning)
  // produce the same key.
  const colaboradoresOrdenados = dados.colaboradorNomes.map(normalizeForSearch).sort();
  return JSON.stringify([
    normalizeForSearch(dados.numero), dados.dataAgendada,
    // The DB's `time` column round-trips as "HH:MM:SS" (via listPericias),
    // while a freshly parsed sheet cell is "HH:MM" (parseHoraCelula) — left
    // uncompared, EVERY row would look "new" against its own existing
    // record, and a re-import would duplicate the whole sheet. Truncate to
    // "HH:MM" so both sources compare equal regardless of which produced them.
    dados.horaAgendada?.slice(0, 5) ?? null,
    normalizeForSearch(dados.peritoNome), colaboradoresOrdenados,
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
    linhasComErro: [], linhasComAviso: [], linhasPuladasPorDuplicidade: [],
  };
  function registrarErro(linha: PericiaPreviewRow, erro: string) {
    relatorio.linhasComErro.push({ linhaOriginal: linha.linhaOriginal, erro });
  }
  function registrarAviso(linha: PericiaPreviewRow, aviso: string) {
    relatorio.linhasComAviso.push({ linhaOriginal: linha.linhaOriginal, erro: aviso });
  }
  function registrarDuplicada(linha: PericiaPreviewRow, motivo: string) {
    relatorio.linhasPuladasPorDuplicidade.push({ linhaOriginal: linha.linhaOriginal, erro: motivo });
  }

  // --- Phase 1 (sync): duplicidade (against the DB and within this sheet).
  // A row identical to another row earlier in the same sheet is treated as a
  // duplicate up front — regardless of whether the earlier row's write
  // ultimately succeeds — since it describes the same real-world perícia.
  const chavesExistentes = new Set(periciasAtuais.map((p) => chavePericia({
    numero: p.processo?.numero ?? '', dataAgendada: p.dataAgendada, horaAgendada: p.horaAgendada,
    peritoNome: p.perito?.nome ?? '', colaboradorNomes: p.colaboradores.map((c) => c.nome), observacoes: p.observacoes,
  })));
  // Maps chave -> the linhaOriginal that first reserved it, so a later
  // duplicate in the same lote can point back at exactly which row it matches.
  const chavesReservadasNesteLote = new Map<string, number>();
  const candidatas: PericiaPreviewRow[] = [];
  for (const linha of linhas) {
    if (linha.status === 'duplicada') {
      relatorio.puladasPorDuplicidade++;
      registrarDuplicada(
        linha,
        'perícia idêntica (mesmo processo, data, hora, perito e colaborador(es)) já estava cadastrada no banco de dados — não foi criada de novo para não duplicar o mesmo agendamento.'
      );
      continue;
    }
    // A row with no identified processo número can't be meaningfully deduped
    // against anything (see the matching note in previewImportacaoPericias).
    if (linha.processoNumero.trim() !== '') {
      const chave = chavePericia({
        numero: linha.processoNumero, dataAgendada: linha.dataAgendada, horaAgendada: linha.horaAgendada,
        peritoNome: linha.peritoNome, colaboradorNomes: splitColaboradorNomes(linha.colaboradorNome),
        observacoes: linha.observacoes,
      });
      const linhaQueReservou = chavesReservadasNesteLote.get(chave);
      if (chavesExistentes.has(chave) || linhaQueReservou !== undefined) {
        relatorio.puladasPorDuplicidade++;
        registrarDuplicada(
          linha,
          linhaQueReservou !== undefined
            ? `linha idêntica à linha ${linhaQueReservou} desta mesma planilha (mesmo processo, data, hora, perito e colaborador(es)) — não foi criada de novo para não duplicar o mesmo agendamento.`
            : 'perícia idêntica (mesmo processo, data, hora, perito e colaborador(es)) já existe no banco de dados — não foi criada de novo para não duplicar o mesmo agendamento.'
        );
        continue;
      }
      chavesReservadasNesteLote.set(chave, linha.linhaOriginal);
    }
    // Missing município/perito/processo no longer reject the row — it's
    // saved as-is (with those references left null) and fixed later via the
    // edit dialog, instead of forcing a full re-import once the sheet is corrected.
    candidatas.push(linha);
  }

  // --- Phase 2 (concurrent): upsert every distinct município this batch needs.
  // municipios is a local table pericias.municipio_id points at; a município
  // resolved from the IBGE API has to land there before the FK will accept it.
  const municipioIds = [...new Set(candidatas.map((l) => l.municipioId).filter((id): id is number => id !== null))];
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

  // --- Phase 3 (sync): a row with no município (never resolved at preview
  // time) passes through untouched — it saves with municipioId null. Only a
  // município that was resolved but genuinely failed to persist drops the row.
  const linhasComMunicipioOk: PericiaPreviewRow[] = [];
  for (const linha of candidatas) {
    if (linha.municipioId === null) {
      linhasComMunicipioOk.push(linha);
      continue;
    }
    const resolucao = municipiosResolvidos.get(linha.municipioId)!;
    if (resolucao !== true) {
      registrarErro(linha, resolucao.erro);
      continue;
    }
    linhasComMunicipioOk.push(linha);
  }

  const processoPorChave = new Map<string, PericiaPreviewRow>();
  for (const linha of linhasComMunicipioOk) {
    if (linha.processoNumero.trim() === '') continue;
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
      const resultado = await updateProcessoComPendencias(existente.id, dados);
      if (!resultado.success) {
        processosResolvidos.set(chave, { erro: `falha ao atualizar processo: ${resultado.error}` });
        return;
      }
      relatorio.processosAtualizados++;
      processosResolvidos.set(chave, { id: existente.id });
      return;
    }
    const resultado = await createProcessoComPendencias(dados);
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
  // cell is simply "no colaboradores," never an error. A row can name more
  // than one, "/"-separated, so this resolves every distinct name across all
  // rows rather than one per row.
  const colaboradorIdPorChave = new Map<string, number>();
  const colaboradorNovoPorChave = new Map<string, { nome: string }>();
  for (const linha of linhasComMunicipioOk) {
    for (const nome of splitColaboradorNomes(linha.colaboradorNome)) {
      const chave = chaveDeLote(nome);
      if (colaboradorIdPorChave.has(chave) || colaboradorNovoPorChave.has(chave)) continue;
      const existente = colaboradoresAtuais.find((c) => normalizeForSearch(c.nome) === chave);
      if (existente) colaboradorIdPorChave.set(chave, existente.id);
      else colaboradorNovoPorChave.set(chave, { nome });
    }
  }
  const colaboradoresNovosResolvidos = new Map<string, Resolucao<number>>();
  await mapComConcorrencia([...colaboradorNovoPorChave.entries()], CONCORRENCIA_IMPORTACAO, async ([chave, amostra]) => {
    // A single-character "name" ("J", "I"...) looks like a parsing artifact,
    // but in real sheets it's often a real, recurring colaborador's shorthand
    // initial — confirmed against production data (the same letter reappears
    // across several rows in the same block). Per the "never drop data" rule,
    // it's still created — the row stays flagged 'suspeito' at preview time,
    // and a confirm-time aviso below, so the user notices and can rename/merge
    // the record via the existing colaborador-merge tool.
    const resultado = await createColaborador({ nome: amostra.nome, contato: '', formacao: '', email: '' });
    if (!resultado.success) {
      colaboradoresNovosResolvidos.set(chave, { erro: `falha ao criar colaborador: ${resultado.error}` });
      return;
    }
    relatorio.colaboradoresCriados++;
    colaboradoresNovosResolvidos.set(chave, { id: resultado.data.id });
  });

  // --- Phase 7: assemble each row's perícia payload, then create every ready
  // perícia concurrently. Processo/perito/colaborador are resolved best-effort:
  // a row with no processo número, no perito name, or only suspicious
  // colaborador names still saves — with those references left null/omitted
  // — instead of being rejected outright. Only a genuine write FAILURE for a
  // reference that WAS resolvable (processo/perito creation erroring, e.g.)
  // still fails the row, since there's nothing salvageable in that case.
  type PericiaPronta = {
    linha: PericiaPreviewRow; processoId: number | null; peritoId: number | null; colaboradorIds: number[];
    colaboradorNomesSuspeitos: string[];
  };
  const prontas: PericiaPronta[] = [];

  for (const linha of linhasComMunicipioOk) {
    let processoId: number | null = null;
    if (linha.processoNumero.trim() !== '') {
      const resolProcesso = processosResolvidos.get(chaveDeLote(linha.processoNumero))!;
      if ('erro' in resolProcesso) {
        registrarErro(linha, resolProcesso.erro);
        continue;
      }
      processoId = resolProcesso.id;
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

    const colaboradorIds: number[] = [];
    const colaboradorNomesSuspeitos: string[] = [];
    let erroColaborador: string | null = null;
    for (const nome of splitColaboradorNomes(linha.colaboradorNome)) {
      const chave = chaveDeLote(nome);
      let colaboradorId = colaboradorIdPorChave.get(chave) ?? null;
      if (colaboradorId === null) {
        const resolColaborador = colaboradoresNovosResolvidos.get(chave);
        if (resolColaborador && 'erro' in resolColaborador) {
          erroColaborador = resolColaborador.erro;
          break;
        }
        colaboradorId = resolColaborador ? resolColaborador.id : null;
      }
      if (colaboradorId !== null) {
        colaboradorIds.push(colaboradorId);
        if (nomeSuspeito(nome)) colaboradorNomesSuspeitos.push(nome);
      }
    }
    if (erroColaborador) {
      registrarErro(linha, erroColaborador);
      continue;
    }

    prontas.push({ linha, processoId, peritoId, colaboradorIds, colaboradorNomesSuspeitos });
  }

  await mapComConcorrencia(prontas, CONCORRENCIA_IMPORTACAO, async ({ linha, processoId, peritoId, colaboradorIds, colaboradorNomesSuspeitos }) => {
    const payload = {
      processoId,
      municipioId: linha.municipioId,
      peritoId,
      colaboradorIds,
      dataAgendada: linha.dataAgendada,
      horaAgendada: linha.horaAgendada,
      situacao: linha.situacao,
      observacoes: linha.observacoes,
      contrato: linha.contrato,
      local: linha.municipioNome || null,
    };
    const resultado = await createPericiaComPendencias(payload);
    if (resultado.success) {
      relatorio.periciasCriadas++;
      if (colaboradorNomesSuspeitos.length > 0) {
        registrarAviso(
          linha,
          `colaborador(es) com nome muito curto vinculado(s): ${colaboradorNomesSuspeitos.map((n) => `"${n}"`).join(', ')}. Confirme se está correto e corrija/mescle o cadastro se necessário.`
        );
      }
      return;
    }
    // A genuine double-booking (the colaborador is already on another
    // processo at this exact date/hora) isn't "missing information" like the
    // other pendências — it's a real scheduling conflict the DB is correctly
    // refusing. But per the same "never reject the row" rule, the pericia
    // still gets created, just without that colaborador attached; the user
    // resolves the conflict and re-links it manually via the edit dialog.
    if (resultado.error === ERRO_COLABORADOR_CONFLITANTE && colaboradorIds.length > 0) {
      const retentativa = await createPericiaComPendencias({ ...payload, colaboradorIds: [] });
      if (retentativa.success) {
        relatorio.periciasCriadas++;
        registrarAviso(
          linha,
          `perícia criada, mas sem o(s) colaborador(es) da planilha: ${ERRO_COLABORADOR_CONFLITANTE} Vincule manualmente após resolver o conflito.`
        );
        return;
      }
      registrarErro(linha, `falha ao criar perícia: ${retentativa.error}`);
      return;
    }
    registrarErro(linha, `falha ao criar perícia: ${resultado.error}`);
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
