'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { colaboradorSchema, type ColaboradorInput } from './schemas';

export type Colaborador = { id: number; nome: string; contato: string; formacao: string; interno: boolean };

function toRow(input: ColaboradorInput) {
  return { nome: input.nome, contato: input.contato, formacao: input.formacao, interno: input.interno };
}

export async function listColaboradores(): Promise<Colaborador[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('colaboradores').select('*').order('nome');
  if (error) throw new Error(error.message);
  return data ?? [];
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
