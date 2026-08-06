'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import type { Database, PeritoRelacao, PeritoResultado } from '@/lib/supabase/database.types';
import { matchesSearch } from '@/lib/search';
import { buscarTodasAsPaginas } from '@/lib/supabase/pagination';
import { peritoSchema, type PeritoInput } from './schemas';

export type Perito = {
  id: number; nome: string; contato: string; formacao: string; crea: string;
  documento: string; jaTrabalhamos: boolean; relacao: PeritoRelacao; resultados: PeritoResultado;
};

function toRow(input: PeritoInput) {
  return {
    nome: input.nome,
    contato: input.contato,
    formacao: input.formacao,
    crea: input.crea,
    documento: input.documento,
    ja_trabalhamos: input.jaTrabalhamos,
    relacao: input.relacao,
    resultados: input.resultados,
  };
}

function fromRow(row: Database['public']['Tables']['peritos']['Row']): Perito {
  return {
    id: row.id, nome: row.nome, contato: row.contato, formacao: row.formacao, crea: row.crea,
    documento: row.documento, jaTrabalhamos: row.ja_trabalhamos, relacao: row.relacao, resultados: row.resultados,
  };
}

export async function listPeritos(busca?: string): Promise<Perito[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const rows = await buscarTodasAsPaginas<Database['public']['Tables']['peritos']['Row']>((inicio, fim) =>
    // `.order('id')` is a secondary tie-breaker: OFFSET-based .range() paging
    // over a non-unique sort column alone can return a row twice or skip one.
    supabase.from('peritos').select('*').order('nome').order('id').range(inicio, fim)
  );
  const peritos = rows.map(fromRow);
  if (!busca?.trim()) return peritos;
  return peritos.filter((perito) => matchesSearch(perito.nome, busca));
}

export async function listPeritosOptions(): Promise<{ id: number; nome: string }[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('peritos').select('id, nome').order('nome');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPerito(id: number): Promise<Perito | null> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('peritos').select('*').eq('id', id).single();
  if (error || !data) return null;
  return fromRow(data);
}

export async function createPerito(input: PeritoInput): Promise<ActionResult<Perito>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = peritoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from('peritos').insert(toRow(parsed.data)).select('*').single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: fromRow(data) };
}

export async function updatePerito(id: number, input: PeritoInput): Promise<ActionResult<Perito>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = peritoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from('peritos').update(toRow(parsed.data)).eq('id', id).select('*').single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: fromRow(data) };
}

export async function deletePerito(id: number): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { error } = await supabase.from('peritos').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return { success: false, error: 'Não é possível excluir: há perícias vinculadas a este perito.' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: null };
}

/**
 * Merges two or more peritos into one, mirroring `mesclarColaboradores`:
 * `survivorId` keeps existing, every perícia pointing at any of `loserIds`
 * is repointed at it, `survivorId`'s fields are overwritten with `input`
 * (the caller's edited/confirmed final values), and every perito in
 * `loserIds` is deleted — all inside one DB transaction (the `merge_peritos`
 * function).
 */
export async function mesclarPeritos(
  survivorId: number,
  loserIds: number[],
  input: PeritoInput
): Promise<ActionResult<Perito>> {
  await requireRole(['admin', 'gerencia']);
  if (loserIds.length === 0) {
    return { success: false, error: 'Selecione ao menos um perito para mesclar' };
  }
  if (loserIds.includes(survivorId)) {
    return { success: false, error: 'Selecione peritos diferentes para mesclar' };
  }
  const parsed = peritoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc('merge_peritos', {
    survivor_id: survivorId,
    loser_ids: loserIds,
    novo_nome: parsed.data.nome,
    novo_contato: parsed.data.contato,
    nova_formacao: parsed.data.formacao,
    novo_crea: parsed.data.crea,
    novo_documento: parsed.data.documento,
    novo_ja_trabalhamos: parsed.data.jaTrabalhamos,
    nova_relacao: parsed.data.relacao,
    novo_resultados: parsed.data.resultados,
  });
  if (error) return { success: false, error: error.message };

  const mesclado = await getPerito(survivorId);
  if (!mesclado) return { success: false, error: 'Perito mesclado não encontrado após a operação' };
  return { success: true, data: mesclado };
}
