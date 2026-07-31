'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { updateNomeSchema, updatePasswordSchema } from './schemas';

export async function updateOwnNome(nome: string): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = updateNomeSchema.safeParse({ nome });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_own_nome', { new_nome: parsed.data.nome });
  if (error) return { success: false, error: error.message };
  revalidatePath('/meu-perfil');
  return { success: true, data: null };
}

export async function updateOwnPassword(password: string): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = updatePasswordSchema.safeParse({ password });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
