'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { processoSchema, type ProcessoInput } from './schemas';

export type Processo = { id: number; numero: string; autor: string; reu: string };

export async function searchProcessos(query: string): Promise<Processo[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let request = supabase.from('processos').select('id, numero, autor, reu').order('numero').limit(20);
  if (query.trim()) {
    request = request.or(`numero.ilike.%${query}%,autor.ilike.%${query}%,reu.ilike.%${query}%`);
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
    .select('id, numero, autor, reu')
    .single();
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Já existe um processo com esse número' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data };
}
