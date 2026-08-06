'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { matchesSearch } from '@/lib/search';
import { buscarTodasAsPaginas } from '@/lib/supabase/pagination';
import { colaboradorSchema, type ColaboradorInput } from './schemas';

export type Colaborador = { id: number; nome: string; contato: string; formacao: string; email: string | null };

function toRow(input: ColaboradorInput) {
  return { nome: input.nome, contato: input.contato, formacao: input.formacao, email: input.email || null };
}

export async function listColaboradores(busca?: string): Promise<Colaborador[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const colaboradores = await buscarTodasAsPaginas<Colaborador>((inicio, fim) =>
    // `.order('id')` is a secondary tie-breaker: OFFSET-based .range() paging
    // over a non-unique sort column alone can return a row twice or skip one.
    supabase.from('colaboradores').select('*').order('nome').order('id').range(inicio, fim)
  );
  if (!busca?.trim()) return colaboradores;
  return colaboradores.filter((colaborador) => matchesSearch(colaborador.nome, busca));
}

export async function listColaboradoresOptions(): Promise<{ id: number; nome: string }[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('colaboradores').select('id, nome').order('nome');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getColaborador(id: number): Promise<Colaborador | null> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('colaboradores').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data;
}

export async function createColaborador(input: ColaboradorInput): Promise<ActionResult<Colaborador>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = colaboradorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from('colaboradores').insert(toRow(parsed.data)).select('*').single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function updateColaborador(
  id: number,
  input: ColaboradorInput
): Promise<ActionResult<Colaborador>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = colaboradorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('colaboradores').update(toRow(parsed.data)).eq('id', id).select('*').single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function deleteColaborador(id: number): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { error } = await supabase.from('colaboradores').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

/**
 * Merges two or more colaboradores (typically duplicates created by a typo,
 * e.g. "Marco Aurelio" / "Marcos Aurelio") into one: `survivorId` keeps
 * existing, every perícia pointing at any of `loserIds` is repointed at it,
 * `survivorId`'s fields are overwritten with `input` (the caller's
 * edited/confirmed final values), and every colaborador in `loserIds` is
 * deleted. All inside one DB transaction (the `merge_colaboradores`
 * function) — a conflict (e.g. the colaborador double-booking trigger)
 * aborts the whole merge instead of leaving it half-done.
 */
export async function mesclarColaboradores(
  survivorId: number,
  loserIds: number[],
  input: ColaboradorInput
): Promise<ActionResult<Colaborador>> {
  await requireRole(['admin', 'gerencia']);
  if (loserIds.length === 0) {
    return { success: false, error: 'Selecione ao menos um colaborador para mesclar' };
  }
  if (loserIds.includes(survivorId)) {
    return { success: false, error: 'Selecione colaboradores diferentes para mesclar' };
  }
  const parsed = colaboradorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc('merge_colaboradores', {
    survivor_id: survivorId,
    loser_ids: loserIds,
    novo_nome: parsed.data.nome,
    novo_contato: parsed.data.contato,
    nova_formacao: parsed.data.formacao,
    novo_email: parsed.data.email || null,
  });
  if (error) return { success: false, error: error.message };

  const mesclado = await getColaborador(survivorId);
  if (!mesclado) return { success: false, error: 'Colaborador mesclado não encontrado após a operação' };
  return { success: true, data: mesclado };
}
