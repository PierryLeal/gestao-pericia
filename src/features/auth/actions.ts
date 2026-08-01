'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/action-result';

const credentialsSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
});

export type AuthActionState = { error: string } | null;

export async function signInWithPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: 'E-mail ou senha inválidos' };
  }
  redirect('/');
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) {
    throw new Error('Não foi possível iniciar o login com Google');
  }
  redirect(data.url);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/redefinir-senha`,
  });
}

export async function updateRecoveryPassword(password: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { success: false, error: error.message };
  await supabase.auth.signOut();
  return { success: true, data: null };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
