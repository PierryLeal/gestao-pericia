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
        perito:peritos!inner ( id, nome, contato, formacao, crea, ja_trabalhamos, relacao, resultados ),
        pericia_colaboradores ( colaborador:colaboradores ( id, nome, contato, formacao ) )
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
    colaboradores: row.pericia_colaboradores.map((pc) => pc.colaborador),
  }));
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
      municipio:municipios ( id, nome, uf ),
      pericia_colaboradores ( colaborador_id )
    `)
    .eq('id', id)
    .single();
  if (error || !data) return null;
  const row = data;
  return {
    id: row.id,
    processoId: row.processo.id,
    dataAgendada: row.data_agendada,
    horaAgendada: row.hora_agendada,
    municipioId: row.municipio.id,
    peritoId: row.perito_id,
    colaboradorIds: row.pericia_colaboradores.map((pc) => pc.colaborador_id),
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
  let query = supabase
    .from('pericia_colaboradores')
    .select('colaborador_id, pericia_id, pericias!inner(processo_id)')
    .eq('pericias.data_agendada', dataAgendada)
    .eq('pericias.hora_agendada', horaAgendada);
  if (processoId) {
    // A colaborador on another pericia for the SAME processo at this date/time is not
    // a real conflict (e.g. two specialists examining the same case together) — only
    // a different processo at the same date/time is a genuine double-booking.
    query = query.neq('pericias.processo_id', processoId);
  }
  if (excludePericiaId) {
    query = query.neq('pericia_id', excludePericiaId);
  }
  const { data, error } = await query;
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
  const rows = await buscarTodasAsPaginas<{
    colaborador: { nome: string };
    pericia: {
      id: number; data_agendada: string | null; hora_agendada: string | null; situacao: PericiaSituacao;
      processo: { numero: string };
    };
  }>((inicio, fim) =>
    supabase
      .from('pericia_colaboradores')
      .select(`
        colaborador:colaboradores!inner(nome),
        pericia:pericias!inner(id, data_agendada, hora_agendada, situacao, processo:processos!inner(numero))
      `)
      .in('colaborador_id', colaboradorIds)
      .order('pericia_id', { ascending: false })
      .order('colaborador_id', { ascending: false })
      .range(inicio, fim)
  );
  return rows.map((row) => ({
    id: row.pericia.id, processoNumero: row.pericia.processo.numero, dataAgendada: row.pericia.data_agendada,
    horaAgendada: row.pericia.hora_agendada, situacao: row.pericia.situacao, donoAtual: row.colaborador.nome,
  }));
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
