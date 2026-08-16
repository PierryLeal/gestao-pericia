'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { postgrestQuoted } from '@/lib/postgrest';
import { matchesSearch } from '@/lib/search';
import { buscarTodasAsPaginas } from '@/lib/supabase/pagination';
import { NUMERO_PROVISORIO_LIKE_PATTERN } from '@/lib/processo-numero-provisorio';
import { processoSchema, processoImportSchema, type ProcessoInput, type ProcessoImportInput } from './schemas';

export type Processo = {
  id: number; numero: string; autor: string; reu: string; escritorio: string;
};

// A processo whose número the import couldn't identify (see
// processo-numero-provisorio.ts) isn't a meaningful, reusable identifier —
// picking one from this list would silently attach a pericia to the wrong
// (unrelated) placeholder row. Those still show up, and are still editable,
// in the full "Processos" listing — just not offered here.
export async function searchProcessos(query: string): Promise<Processo[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let request = supabase
    .from('processos')
    .select('id, numero, autor, reu, escritorio')
    .not('numero', 'like', NUMERO_PROVISORIO_LIKE_PATTERN)
    .order('numero')
    .limit(20);
  if (query.trim()) {
    const pattern = postgrestQuoted(`%${query}%`);
    request = request.or(`numero.ilike.${pattern},autor.ilike.${pattern},reu.ilike.${pattern}`);
  }
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProcesso(input: ProcessoInput): Promise<ActionResult<Processo>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = processoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('processos')
    .insert(parsed.data)
    .select('id, numero, autor, reu, escritorio')
    .single();
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Já existe um processo com esse número' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

/** Used only by the bulk-import confirm flow — see `processoImportSchema`. */
export async function createProcessoComPendencias(input: ProcessoImportInput): Promise<ActionResult<Processo>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = processoImportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('processos')
    .insert(parsed.data)
    .select('id, numero, autor, reu, escritorio')
    .single();
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Já existe um processo com esse número' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

/** Used only by the bulk-import confirm flow — see `processoImportSchema`. */
export async function updateProcessoComPendencias(id: number, input: ProcessoImportInput): Promise<ActionResult<Processo>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = processoImportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('processos')
    .update(parsed.data)
    .eq('id', id)
    .select('id, numero, autor, reu, escritorio')
    .single();
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Já existe um processo com esse número' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

export async function listProcessos(filters: { busca?: string } = {}): Promise<Processo[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let processos = await buscarTodasAsPaginas<Processo>((inicio, fim) => {
    const query = supabase.from('processos').select('id, numero, autor, reu, escritorio');
    // `.order('id')` is a secondary tie-breaker: OFFSET-based .range() paging
    // over a non-unique sort column alone can return a row twice or skip one.
    return query.order('numero').order('id').range(inicio, fim);
  });
  if (filters.busca?.trim()) {
    const busca = filters.busca;
    processos = processos.filter(
      (processo) =>
        matchesSearch(processo.numero, busca) ||
        matchesSearch(processo.autor, busca) ||
        matchesSearch(processo.reu, busca)
    );
  }
  return processos;
}

export async function getProcesso(id: number): Promise<Processo | null> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('processos')
    .select('id, numero, autor, reu, escritorio')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data;
}

export async function updateProcesso(id: number, input: ProcessoInput): Promise<ActionResult<Processo>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = processoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('processos')
    .update(parsed.data)
    .eq('id', id)
    .select('id, numero, autor, reu, escritorio')
    .single();
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Já existe um processo com esse número' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

export async function deleteProcesso(id: number): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { error } = await supabase.from('processos').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return { success: false, error: 'Não é possível excluir: há perícias vinculadas a este processo.' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: null };
}

export async function listEscritoriosDistintos(): Promise<string[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  // Unbounded .select() silently truncates at PostgREST's 1000-row cap (see
  // buscarTodasAsPaginas) — confirmed the hard way: with ~1566 of 2003
  // processos rows blank and the rest sorted after them ascending, the first
  // (and only) page fetched was 1000 rows deep into the blanks and never
  // reached a single real escritorio value, making the picker look
  // permanently empty despite 437 real values existing in the table.
  const rows = await buscarTodasAsPaginas<{ escritorio: string | null }>((inicio, fim) =>
    supabase.from('processos').select('escritorio').order('escritorio').range(inicio, fim)
  );
  const values = rows.map((row) => row.escritorio).filter((v): v is string => Boolean(v));
  return [...new Set(values)];
}

