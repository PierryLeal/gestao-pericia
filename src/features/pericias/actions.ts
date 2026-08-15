'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';
import type { PericiaSituacao, PeritoRelacao, PeritoResultado } from '@/lib/supabase/database.types';
import { buscarTodasAsPaginas, buscarPorIdsEmLotes } from '@/lib/supabase/pagination';
import { postgrestQuoted } from '@/lib/postgrest';
import { normalizeForSearch } from '@/lib/search';
import { nomeSuspeito } from '@/lib/nome-suspeito';
import { isNumeroProvisorio } from '@/lib/processo-numero-provisorio';
import { periciaSchema, periciaImportSchema, situacaoOptions, type PericiaInput, type PericiaImportInput } from './schemas';
import { ERRO_COLABORADOR_CONFLITANTE } from './constants';

export type PericiaListItem = {
  id: number;
  dataAgendada: string | null;
  horaAgendada: string | null;
  situacao: PericiaInput['situacao'];
  observacoes: string | null;
  processo: Processo | null;
  municipio: MunicipioIBGE | null;
  perito: {
    id: number; nome: string; contato: string; formacao: string; crea: string;
    jaTrabalhamos: boolean; relacao: PeritoRelacao; resultados: PeritoResultado;
  } | null;
  colaboradores: { id: number; nome: string; contato: string; formacao: string }[];
  // A processo can legitimately be worked under more than one contrato over
  // time, so this lives on the pericia, not on processo.
  contrato: string | null;
  // The place label for this pericia (see periciaBaseShape in schemas.ts) —
  // município's name for manual entries, or the sheet's raw LOCAL text for
  // imports (a site code that often doesn't resolve to a real município).
  local: string | null;
  /** Missing references left behind by a bulk import that skipped nothing —
   *  surfaced in the UI instead of silently hiding an incomplete pericia. */
  problemas: string[];
};

function problemasDaPericia(row: {
  processo: { numero: string; autor: string; reu: string } | null;
  municipio: unknown; perito: unknown; colaboradores: { nome: string }[];
}): string[] {
  const problemas: string[] = [];
  if (!row.processo) problemas.push('processo não vinculado');
  else {
    if (isNumeroProvisorio(row.processo.numero)) problemas.push('número do processo não identificado na importação');
    if (!row.processo.autor.trim()) problemas.push('autor do processo não identificado');
    if (!row.processo.reu.trim()) problemas.push('réu do processo não identificado');
  }
  if (!row.municipio) problemas.push('município não vinculado');
  if (!row.perito) problemas.push('perito não vinculado');
  for (const colaborador of row.colaboradores) {
    if (nomeSuspeito(colaborador.nome)) problemas.push(`colaborador "${colaborador.nome}" com nome muito curto`);
  }
  return problemas;
}

export async function listPericias(
  filters: {
    situacao?: string; busca?: string; dataInicio?: string; dataFim?: string;
    municipioId?: number; peritoId?: number; colaboradorId?: number; contrato?: string;
  } = {}
): Promise<PericiaListItem[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();

  // colaboradorId now lives on a join table, not a pericias column — resolve
  // the matching pericia ids up front and filter the main query by id.
  let idsFiltroColaborador: number[] | null = null;
  if (filters.colaboradorId) {
    const { data, error } = await supabase
      .from('pericia_colaboradores')
      .select('pericia_id')
      .eq('colaborador_id', filters.colaboradorId);
    if (error) throw new Error(error.message);
    idsFiltroColaborador = (data ?? []).map((row) => row.pericia_id);
    if (idsFiltroColaborador.length === 0) return [];
  }

  // busca matches numero/autor/reu on `processos`, reached only through the
  // plain (non-`!inner`) embed below. PostgREST does NOT drop top-level rows
  // when you filter through a non-inner embed (even via `.or(..., {
  // referencedTable })`) — it just nulls out the embedded object for rows
  // that don't match, so this silently returned every pericia regardless of
  // the search term. Resolving matching processo ids up front and filtering
  // pericias by `processo_id` — same pattern as colaboradorId above — filters
  // for real.
  let idsFiltroBusca: number[] | null = null;
  if (filters.busca) {
    const pattern = postgrestQuoted(`%${filters.busca}%`);
    const { data, error } = await supabase
      .from('processos')
      .select('id')
      .or(`numero.ilike.${pattern},autor.ilike.${pattern},reu.ilike.${pattern}`);
    if (error) throw new Error(error.message);
    idsFiltroBusca = (data ?? []).map((row) => row.id);
    if (idsFiltroBusca.length === 0) return [];
  }

  function construirPagina(inicio: number, fim: number, idsPericiaDoLote?: number[], idsProcessoDoLote?: number[]) {
    // Plain (non-`!inner`) embeds: a bulk-imported pericia can now be missing
    // its processo/município/perito, and an inner join would silently drop
    // those rows from every list instead of surfacing them as incomplete.
    let query = supabase
      .from('pericias')
      .select(`
        id, data_agendada, hora_agendada, situacao, observacoes, contrato, local,
        processo:processos ( id, numero, autor, reu, escritorio ),
        municipio:municipios ( id, nome, uf ),
        perito:peritos ( id, nome, contato, formacao, crea, ja_trabalhamos, relacao, resultados )
      `)
      // `.order('id')` is a secondary, always-unique tie-breaker: many rows
      // legitimately share the same data_agendada, and OFFSET-based .range()
      // pagination over a non-unique sort order can return the same row on
      // two pages (or skip one) — Postgres doesn't guarantee stable tie
      // ordering across separate queries without a deterministic total order.
      .order('data_agendada', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false });

    if (filters.situacao && situacaoOptions.includes(filters.situacao as (typeof situacaoOptions)[number])) {
      // filters.situacao is a caller-supplied string (e.g. a URL search param); it is
      // validated against the known situacao values above before being narrowed to the
      // PericiaSituacao literal union, so an invalid value is silently ignored instead
      // of reaching the database and throwing.
      query = query.eq('situacao', filters.situacao as PericiaSituacao);
    }
    if (filters.dataInicio) {
      query = query.gte('data_agendada', filters.dataInicio);
    }
    if (filters.dataFim) {
      query = query.lte('data_agendada', filters.dataFim);
    }
    if (filters.municipioId) {
      query = query.eq('municipio_id', filters.municipioId);
    }
    if (filters.peritoId) {
      query = query.eq('perito_id', filters.peritoId);
    }
    if (filters.contrato) {
      query = query.eq('contrato', filters.contrato);
    }
    if (idsPericiaDoLote) {
      query = query.in('id', idsPericiaDoLote);
    }
    if (idsProcessoDoLote) {
      query = query.in('processo_id', idsProcessoDoLote);
    }

    return query.range(inicio, fim);
  }

  // A colaborador with a long history, or a busca term matching many
  // processos, can have hundreds/thousands of matching ids — chunked the same
  // way as buscarColaboradoresPorPericiaIds, or that many ids in one .in()
  // blows past PostgREST's URL/header size limit. When both filters are
  // active at once (rare), only colaboradorId drives the chunked pagination;
  // idsFiltroBusca rides along as a plain filter on every lote — a single
  // colaborador realistically never touches enough distinct processos to hit
  // that limit.
  let data;
  if (idsFiltroColaborador) {
    data = await buscarPorIdsEmLotes(idsFiltroColaborador, (idsDoLote, inicio, fim) =>
      construirPagina(inicio, fim, idsDoLote, idsFiltroBusca ?? undefined)
    );
  } else if (idsFiltroBusca) {
    data = await buscarPorIdsEmLotes(idsFiltroBusca, (idsDoLote, inicio, fim) =>
      construirPagina(inicio, fim, undefined, idsDoLote)
    );
  } else {
    data = await buscarTodasAsPaginas((inicio, fim) => construirPagina(inicio, fim));
  }
  const colaboradoresPorPericia = await buscarColaboradoresPorPericiaIds(
    supabase,
    data.map((row) => row.id)
  );

  return data.map((row) => {
    const perito = row.perito
      ? {
          id: row.perito.id,
          nome: row.perito.nome,
          contato: row.perito.contato,
          formacao: row.perito.formacao,
          crea: row.perito.crea,
          jaTrabalhamos: row.perito.ja_trabalhamos,
          relacao: row.perito.relacao,
          resultados: row.perito.resultados,
        }
      : null;
    const colaboradores = colaboradoresPorPericia.get(row.id) ?? [];
    return {
      id: row.id,
      dataAgendada: row.data_agendada,
      horaAgendada: row.hora_agendada,
      situacao: row.situacao,
      observacoes: row.observacoes,
      processo: row.processo,
      municipio: row.municipio,
      perito,
      colaboradores,
      contrato: row.contrato,
      local: row.local,
      problemas: problemasDaPericia({ processo: row.processo, municipio: row.municipio, perito, colaboradores }),
    };
  });
}

// PostgREST's automatic relationship embedding between `pericias` and
// `pericia_colaboradores` has been unreliable in production (intermittent
// "Could not find a relationship" errors from its schema cache) — querying
// pericia_colaboradores as its own, unembedded table and joining in JS
// sidesteps that relationship-graph resolution entirely.
async function buscarColaboradoresPorPericiaIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  periciaIds: number[]
): Promise<Map<number, { id: number; nome: string; contato: string; formacao: string }[]>> {
  const porPericia = new Map<number, { id: number; nome: string; contato: string; formacao: string }[]>();
  if (periciaIds.length === 0) return porPericia;

  const linhas = await buscarPorIdsEmLotes<{
    pericia_id: number;
    colaborador: { id: number; nome: string; contato: string; formacao: string };
  }>(periciaIds, (idsDoLote, inicio, fim) =>
    supabase
      .from('pericia_colaboradores')
      .select('pericia_id, colaborador:colaboradores!inner ( id, nome, contato, formacao )')
      .in('pericia_id', idsDoLote)
      .range(inicio, fim)
  );

  for (const linha of linhas) {
    const atuais = porPericia.get(linha.pericia_id) ?? [];
    atuais.push(linha.colaborador);
    porPericia.set(linha.pericia_id, atuais);
  }
  return porPericia;
}

export async function createPericia(input: PericiaInput): Promise<ActionResult<{ id: number }>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = periciaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_pericia_with_colaboradores', {
    p_processo_id: parsed.data.processoId,
    p_data_agendada: parsed.data.dataAgendada,
    p_hora_agendada: parsed.data.horaAgendada,
    p_municipio_id: parsed.data.municipioId,
    p_perito_id: parsed.data.peritoId,
    p_situacao: parsed.data.situacao,
    p_observacoes: parsed.data.observacoes,
    p_colaborador_ids: parsed.data.colaboradorIds,
    p_contrato: parsed.data.contrato,
    p_local: parsed.data.local,
  });
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: ERRO_COLABORADOR_CONFLITANTE };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: { id: data as number } };
}

/**
 * Used only by the bulk-import confirm flow — saves a pericia even when its
 * processo/município/perito couldn't be resolved from the sheet, instead of
 * dropping the row. The gaps can be filled in incrementally later via the
 * normal edit dialog — `updatePericia` below accepts the same partial shape,
 * so one missing field can be fixed without having to supply all of them at
 * once (the pericias listing keeps flagging what's still missing).
 */
export async function createPericiaComPendencias(input: PericiaImportInput): Promise<ActionResult<{ id: number }>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = periciaImportSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_pericia_with_colaboradores', {
    p_processo_id: parsed.data.processoId,
    p_data_agendada: parsed.data.dataAgendada,
    p_hora_agendada: parsed.data.horaAgendada,
    p_municipio_id: parsed.data.municipioId,
    p_perito_id: parsed.data.peritoId,
    p_situacao: parsed.data.situacao,
    p_observacoes: parsed.data.observacoes,
    p_colaborador_ids: parsed.data.colaboradorIds,
    p_contrato: parsed.data.contrato,
    p_local: parsed.data.local,
  });
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: ERRO_COLABORADOR_CONFLITANTE };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: { id: data as number } };
}

// Accepts the same partial shape as createPericiaComPendencias (nullable
// processo/município/perito) rather than the strict `periciaSchema` — a
// pericia created incomplete by import (or left incomplete deliberately)
// must be editable one field at a time, without forcing every gap to be
// filled before any single change can be saved. The manual "Nova perícia"
// dialog still enforces the strict schema client-side on create.
export async function updatePericia(
  id: number,
  input: PericiaImportInput
): Promise<ActionResult<{ id: number }>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = periciaImportSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_pericia_with_colaboradores', {
    p_id: id,
    p_processo_id: parsed.data.processoId,
    p_data_agendada: parsed.data.dataAgendada,
    p_hora_agendada: parsed.data.horaAgendada,
    p_municipio_id: parsed.data.municipioId,
    p_perito_id: parsed.data.peritoId,
    p_situacao: parsed.data.situacao,
    p_observacoes: parsed.data.observacoes,
    p_colaborador_ids: parsed.data.colaboradorIds,
    p_contrato: parsed.data.contrato,
    p_local: parsed.data.local,
  });
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: ERRO_COLABORADOR_CONFLITANTE };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: { id } };
}

export type EditingPericia = {
  id: number;
  processoId: number | null;
  dataAgendada: string | null;
  horaAgendada: string | null;
  municipioId: number | null;
  peritoId: number | null;
  colaboradorIds: number[];
  situacao: PericiaInput['situacao'];
  observacoes: string | null;
  contrato: string | null;
  local: string | null;
  processo: Processo | null;
  municipio: MunicipioIBGE | null;
};

export async function getPericiaForEdit(id: number): Promise<EditingPericia | null> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pericias')
    .select(`
      id, data_agendada, hora_agendada, situacao, observacoes, perito_id, contrato, local,
      processo:processos ( id, numero, autor, reu, escritorio ),
      municipio:municipios ( id, nome, uf )
    `)
    .eq('id', id)
    .single();
  if (error || !data) return null;
  const row = data;
  const { data: colaboradoresLinks, error: colaboradoresError } = await supabase
    .from('pericia_colaboradores')
    .select('colaborador_id')
    .eq('pericia_id', id);
  if (colaboradoresError) return null;
  return {
    id: row.id,
    processoId: row.processo?.id ?? null,
    dataAgendada: row.data_agendada,
    // Postgres' `time` column round-trips as "HH:MM:SS", but the edit
    // form's <input type="time"> and its Zod schema both expect "HH:MM" —
    // left as-is, saving without touching the time field failed validation
    // (same asymmetry already handled in chavePericia, see importacao/actions.ts).
    horaAgendada: row.hora_agendada?.slice(0, 5) ?? null,
    municipioId: row.municipio?.id ?? null,
    peritoId: row.perito_id,
    colaboradorIds: (colaboradoresLinks ?? []).map((pc) => pc.colaborador_id),
    situacao: row.situacao,
    observacoes: row.observacoes,
    contrato: row.contrato,
    local: row.local,
    processo: row.processo,
    municipio: row.municipio,
  };
}

export async function deletePericia(id: number): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { error } = await supabase.from('pericias').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function getColaboradoresIndisponiveis(
  dataAgendada: string,
  horaAgendada: string,
  processoId?: number,
  excludePericiaId?: number,
  peritoId?: number,
  local?: string | null,
  situacaoAtual?: PericiaSituacao
): Promise<number[]> {
  await requireRole(['admin', 'gerencia']);

  // A CANCELADA pericia doesn't occupy the colaborador's time at all — it's
  // not going to happen — so it can never conflict with anything, regardless
  // of who else is at this date/hora. Mirrors check_colaborador_conflito and
  // the import preview's own conflict predictor.
  if (situacaoAtual === 'cancelada') return [];

  const supabase = await createClient();

  // Resolved in two unembedded queries (pericias, then pericia_colaboradores)
  // instead of one query embedding pericias!inner from pericia_colaboradores —
  // see buscarColaboradoresPorPericiaIds above for why.
  let periciasQuery = supabase
    .from('pericias')
    .select('id, processo_id, perito_id, local, situacao')
    .eq('data_agendada', dataAgendada)
    .eq('hora_agendada', horaAgendada)
    .neq('situacao', 'cancelada');
  if (processoId) {
    // A colaborador on another pericia for the SAME processo at this date/time is not
    // a real conflict (e.g. two specialists examining the same case together) — only
    // a different processo at the same date/time is a genuine double-booking.
    periciasQuery = periciasQuery.neq('processo_id', processoId);
  }
  const { data: periciasNoSlot, error: periciasError } = await periciasQuery;
  if (periciasError) throw new Error(periciasError.message);
  let periciasNoSlotFiltradas = periciasNoSlot ?? [];
  if (excludePericiaId) {
    periciasNoSlotFiltradas = periciasNoSlotFiltradas.filter((p) => p.id !== excludePericiaId);
  }
  const localNormalizado = local?.trim() ? normalizeForSearch(local) : null;
  if (peritoId && localNormalizado) {
    // Same perito + local at this exact date/hora is understood as sequential
    // work, not a double-booking — the colaborador wraps up one pericia and
    // moves straight into the next. `local` (not município, which a company
    // site code often never resolves to) is what actually tells "same place"
    // — mirrors the DB trigger's own exemption (see check_colaborador_conflito).
    periciasNoSlotFiltradas = periciasNoSlotFiltradas.filter(
      (p) => !(p.perito_id === peritoId && p.local?.trim() && normalizeForSearch(p.local) === localNormalizado)
    );
  }
  const periciaIds = periciasNoSlotFiltradas.map((p) => p.id);
  if (periciaIds.length === 0) return [];

  const rows = await buscarPorIdsEmLotes<{ colaborador_id: number }>(periciaIds, (idsDoLote, inicio, fim) =>
    supabase
      .from('pericia_colaboradores')
      .select('colaborador_id')
      .in('pericia_id', idsDoLote)
      .range(inicio, fim)
  );
  return rows.map((row) => row.colaborador_id);
}

export type PericiaResumoMesclagem = {
  id: number;
  processoNumero: string;
  dataAgendada: string | null;
  horaAgendada: string | null;
  situacao: PericiaSituacao;
  donoAtual: string;
};

/**
 * Perícias currently assigned to any of `colaboradorIds` — used by the
 * colaborador merge dialog to preview, before confirming, exactly which
 * perícias get reassigned to the survivor. One row per (perícia, colaborador)
 * link being reassigned — a perícia with an unrelated second colaborador not
 * in `colaboradorIds` is untouched and doesn't produce an extra row for it.
 */
export async function listPericiasPorColaboradorIds(colaboradorIds: number[]): Promise<PericiaResumoMesclagem[]> {
  await requireRole(['admin', 'gerencia']);
  if (colaboradorIds.length === 0) return [];
  const supabase = await createClient();

  // Two unembedded queries (pericia_colaboradores links, then pericias) instead
  // of one embedding pericias!inner from pericia_colaboradores — see
  // buscarColaboradoresPorPericiaIds above for why.
  const links = await buscarTodasAsPaginas<{ pericia_id: number; colaborador: { nome: string } }>((inicio, fim) =>
    supabase
      .from('pericia_colaboradores')
      .select('pericia_id, colaborador:colaboradores!inner(nome)')
      .in('colaborador_id', colaboradorIds)
      .order('pericia_id', { ascending: false })
      .order('colaborador_id', { ascending: false })
      .range(inicio, fim)
  );
  if (links.length === 0) return [];

  const periciaIds = [...new Set(links.map((l) => l.pericia_id))];
  const periciasRows = await buscarPorIdsEmLotes<{
    id: number; data_agendada: string | null; hora_agendada: string | null; situacao: PericiaSituacao;
    processo: { numero: string };
  }>(periciaIds, (idsDoLote, inicio, fim) =>
    supabase
      .from('pericias')
      .select('id, data_agendada, hora_agendada, situacao, processo:processos!inner(numero)')
      .in('id', idsDoLote)
      .range(inicio, fim)
  );
  const periciasPorId = new Map(periciasRows.map((p) => [p.id, p]));

  return links.flatMap((link) => {
    const pericia = periciasPorId.get(link.pericia_id);
    if (!pericia) return [];
    return [{
      id: pericia.id, processoNumero: pericia.processo.numero, dataAgendada: pericia.data_agendada,
      horaAgendada: pericia.hora_agendada, situacao: pericia.situacao, donoAtual: link.colaborador.nome,
    }];
  });
}

/**
 * Perícias currently assigned to any of `peritoIds` — used by the perito
 * merge dialog to preview, before confirming, exactly which perícias get
 * reassigned to the survivor.
 */
export async function listPericiasPorPeritoIds(peritoIds: number[]): Promise<PericiaResumoMesclagem[]> {
  await requireRole(['admin', 'gerencia']);
  if (peritoIds.length === 0) return [];
  const supabase = await createClient();
  const rows = await buscarTodasAsPaginas<{
    id: number; data_agendada: string | null; hora_agendada: string | null; situacao: PericiaSituacao;
    processo: { numero: string }; perito: { nome: string };
  }>((inicio, fim) =>
    supabase
      .from('pericias')
      .select('id, data_agendada, hora_agendada, situacao, processo:processos!inner(numero), perito:peritos!inner(nome)')
      .in('perito_id', peritoIds)
      .order('data_agendada', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(inicio, fim)
  );
  return rows.map((row) => ({
    id: row.id, processoNumero: row.processo.numero, dataAgendada: row.data_agendada,
    horaAgendada: row.hora_agendada, situacao: row.situacao, donoAtual: row.perito.nome,
  }));
}

export async function listContratosDistintos(): Promise<string[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('pericias').select('contrato').order('contrato');
  if (error) throw new Error(error.message);
  const values = (data ?? []).map((row) => row.contrato).filter((v): v is string => Boolean(v));
  return [...new Set(values)];
}
