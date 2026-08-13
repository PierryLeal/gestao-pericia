'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';
import type { PericiaSituacao, PeritoRelacao, PeritoResultado } from '@/lib/supabase/database.types';
import { buscarTodasAsPaginas } from '@/lib/supabase/pagination';
import { postgrestQuoted } from '@/lib/postgrest';
import { periciaSchema, situacaoOptions, type PericiaInput } from './schemas';

export type PericiaListItem = {
  id: number;
  dataAgendada: string | null;
  horaAgendada: string | null;
  situacao: PericiaInput['situacao'];
  observacoes: string | null;
  processo: { id: number; numero: string; autor: string; reu: string; escritorio: string };
  municipio: { id: number; nome: string; uf: string };
  perito: {
    id: number; nome: string; contato: string; formacao: string; crea: string;
    jaTrabalhamos: boolean; relacao: PeritoRelacao; resultados: PeritoResultado;
  };
  colaboradores: { id: number; nome: string; contato: string; formacao: string }[];
};

export async function listPericias(
  filters: {
    situacao?: string; busca?: string; dataInicio?: string; dataFim?: string;
    municipioId?: number; peritoId?: number; colaboradorId?: number;
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

  function construirPagina(inicio: number, fim: number) {
    let query = supabase
      .from('pericias')
      .select(`
        id, data_agendada, hora_agendada, situacao, observacoes,
        processo:processos!inner ( id, numero, autor, reu, escritorio ),
        municipio:municipios!inner ( id, nome, uf ),
        perito:peritos!inner ( id, nome, contato, formacao, crea, ja_trabalhamos, relacao, resultados )
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
    if (filters.busca) {
      const pattern = postgrestQuoted(`%${filters.busca}%`);
      query = query.or(`numero.ilike.${pattern},autor.ilike.${pattern},reu.ilike.${pattern}`, {
        referencedTable: 'processo',
      });
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
    if (idsFiltroColaborador) {
      query = query.in('id', idsFiltroColaborador);
    }

    return query.range(inicio, fim);
  }

  const data = await buscarTodasAsPaginas(construirPagina);
  const colaboradoresPorPericia = await buscarColaboradoresPorPericiaIds(
    supabase,
    data.map((row) => row.id)
  );

  return data.map((row) => ({
    id: row.id,
    dataAgendada: row.data_agendada,
    horaAgendada: row.hora_agendada,
    situacao: row.situacao,
    observacoes: row.observacoes,
    processo: row.processo,
    municipio: row.municipio,
    perito: {
      id: row.perito.id,
      nome: row.perito.nome,
      contato: row.perito.contato,
      formacao: row.perito.formacao,
      crea: row.perito.crea,
      jaTrabalhamos: row.perito.ja_trabalhamos,
      relacao: row.perito.relacao,
      resultados: row.perito.resultados,
    },
    colaboradores: colaboradoresPorPericia.get(row.id) ?? [],
  }));
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

  const linhas = await buscarTodasAsPaginas<{
    pericia_id: number;
    colaborador: { id: number; nome: string; contato: string; formacao: string };
  }>((inicio, fim) =>
    supabase
      .from('pericia_colaboradores')
      .select('pericia_id, colaborador:colaboradores!inner ( id, nome, contato, formacao )')
      .in('pericia_id', periciaIds)
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
  });
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: { id: data as number } };
}

export async function updatePericia(
  id: number,
  input: PericiaInput
): Promise<ActionResult<{ id: number }>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = periciaSchema.safeParse(input);
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
  });
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: { id } };
}

export async function getPericiaForEdit(
  id: number
): Promise<(PericiaInput & { id: number; processo: Processo; municipio: MunicipioIBGE }) | null> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pericias')
    .select(`
      id, data_agendada, hora_agendada, situacao, observacoes, perito_id,
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
    processoId: row.processo.id,
    dataAgendada: row.data_agendada,
    horaAgendada: row.hora_agendada,
    municipioId: row.municipio.id,
    peritoId: row.perito_id,
    colaboradorIds: (colaboradoresLinks ?? []).map((pc) => pc.colaborador_id),
    situacao: row.situacao,
    observacoes: row.observacoes,
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
  excludePericiaId?: number
): Promise<number[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();

  // Resolved in two unembedded queries (pericias, then pericia_colaboradores)
  // instead of one query embedding pericias!inner from pericia_colaboradores —
  // see buscarColaboradoresPorPericiaIds above for why.
  let periciasQuery = supabase
    .from('pericias')
    .select('id, processo_id')
    .eq('data_agendada', dataAgendada)
    .eq('hora_agendada', horaAgendada);
  if (processoId) {
    // A colaborador on another pericia for the SAME processo at this date/time is not
    // a real conflict (e.g. two specialists examining the same case together) — only
    // a different processo at the same date/time is a genuine double-booking.
    periciasQuery = periciasQuery.neq('processo_id', processoId);
  }
  const { data: periciasNoSlot, error: periciasError } = await periciasQuery;
  if (periciasError) throw new Error(periciasError.message);
  let periciaIds = (periciasNoSlot ?? []).map((p) => p.id);
  if (excludePericiaId) {
    periciaIds = periciaIds.filter((id) => id !== excludePericiaId);
  }
  if (periciaIds.length === 0) return [];

  const { data, error } = await supabase
    .from('pericia_colaboradores')
    .select('colaborador_id')
    .in('pericia_id', periciaIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.colaborador_id as number);
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
  const periciasRows = await buscarTodasAsPaginas<{
    id: number; data_agendada: string | null; hora_agendada: string | null; situacao: PericiaSituacao;
    processo: { numero: string };
  }>((inicio, fim) =>
    supabase
      .from('pericias')
      .select('id, data_agendada, hora_agendada, situacao, processo:processos!inner(numero)')
      .in('id', periciaIds)
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
