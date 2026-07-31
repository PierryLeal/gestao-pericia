'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { updateRoleSchema, createUserSchema, type Role } from './schemas';

export type ProfileRow = { id: string; nome: string; email: string; role: Role };

export async function listProfiles(): Promise<ProfileRow[]> {
  await requireRole(['admin']);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, email, role')
    .order('created_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateProfileRole(userId: string, role: Role): Promise<ActionResult<null>> {
  await requireRole(['admin']);
  const parsed = updateRoleSchema.safeParse({ userId, role });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role: parsed.data.role }).eq('id', parsed.data.userId);
  if (error) return { success: false, error: error.message };
  revalidatePath('/perfis');
  return { success: true, data: null };
}

export async function createUser(input: {
  nome: string; email: string; password: string; role: Role;
}): Promise<ActionResult<null>> {
  await requireRole(['admin']);
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (error) return { success: false, error: error.message };

  const { error: profileError } = await admin
    .from('profiles')
    .update({ nome: parsed.data.nome, role: parsed.data.role })
    .eq('id', data.user.id);
  if (profileError) return { success: false, error: profileError.message };

  revalidatePath('/perfis');
  return { success: true, data: null };
}
