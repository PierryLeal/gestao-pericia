'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';
import type { PericiaSituacao, PeritoRelacao, PeritoResultado } from '@/lib/supabase/database.types';
import { periciaSchema, situacaoOptions, type PericiaInput } from './schemas';

export type PericiaListItem = {
  id: number;
  dataAgendada: string | null;
  horaAgendada: string | null;
  situacao: PericiaInput['situacao'];
  observacoes: string | null;
  processo: { id: number; numero: string; autor: string; reu: string };
  municipio: { id: number; nome: string; uf: string };
  perito: {
    id: number; nome: string; contato: string; formacao: string; crea: string;
    jaTrabalhamos: boolean; relacao: PeritoRelacao; resultados: PeritoResultado;
  };
  colaborador: { id: number; nome: string; contato: string; formacao: string; interno: boolean } | null;
};

function toRow(input: PericiaInput) {
  return {
    processo_id: input.processoId,
    data_agendada: input.dataAgendada,
    hora_agendada: input.horaAgendada,
    municipio_id: input.municipioId,
    perito_id: input.peritoId,
    colaborador_id: input.colaboradorId,
    situacao: input.situacao,
    observacoes: input.observacoes,
  };
}

export async function listPericias(
  filters: {
    situacao?: string; busca?: string; dataInicio?: string; dataFim?: string;
    municipioId?: number; peritoId?: number; colaboradorId?: number;
  } = {}
): Promise<PericiaListItem[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let query = supabase
    .from('pericias')
    .select(`
      id, data_agendada, hora_agendada, situacao, observacoes,
      processo:processos!inner ( id, numero, autor, reu ),
      municipio:municipios!inner ( id, nome, uf ),
      perito:peritos!inner ( id, nome, contato, formacao, crea, ja_trabalhamos, relacao, resultados ),
      colaborador:colaboradores ( id, nome, contato, formacao, interno )
    `)
    .order('data_agendada', { ascending: false, nullsFirst: false });

  if (filters.situacao && situacaoOptions.includes(filters.situacao as (typeof situacaoOptions)[number])) {
    // filters.situacao is a caller-supplied string (e.g. a URL search param); it is
    // validated against the known situacao values above before being narrowed to the
    // PericiaSituacao literal union, so an invalid value is silently ignored instead
    // of reaching the database and throwing.
    query = query.eq('situacao', filters.situacao as PericiaSituacao);
  }
  if (filters.busca) {
    query = query.filter('processo.numero', 'ilike', `%${filters.busca}%`);
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
  if (filters.colaboradorId) {
    query = query.eq('colaborador_id', filters.colaboradorId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
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
    colaborador: row.colaborador
      ? {
          id: row.colaborador.id,
          nome: row.colaborador.nome,
          contato: row.colaborador.contato,
          formacao: row.colaborador.formacao,
          interno: row.colaborador.interno,
        }
      : null,
  }));
}

export async function createPericia(input: PericiaInput): Promise<ActionResult<{ id: number }>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = periciaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from('pericias').insert(toRow(parsed.data)).select('id').single();
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

export async function updatePericia(
  id: number,
  input: PericiaInput
): Promise<ActionResult<{ id: number }>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = periciaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from('pericias').update(toRow(parsed.data)).eq('id', id);
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
      id, data_agendada, hora_agendada, situacao, observacoes, perito_id, colaborador_id,
      processo:processos ( id, numero, autor, reu ),
      municipio:municipios ( id, nome, uf )
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
    colaboradorId: row.colaborador_id,
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
  excludePericiaId?: number
): Promise<number[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let query = supabase
    .from('pericias')
    .select('colaborador_id')
    .eq('data_agendada', dataAgendada)
    .eq('hora_agendada', horaAgendada)
    .not('colaborador_id', 'is', null);
  if (excludePericiaId) {
    query = query.neq('id', excludePericiaId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.colaborador_id as number);
}
