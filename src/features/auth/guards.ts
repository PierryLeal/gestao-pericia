import { createClient } from '@/lib/supabase/server';
import type { ProfileRoleValue } from '@/lib/supabase/database.types';

export type Role = ProfileRoleValue;

export type CurrentProfile = {
  id: string;
  nome: string;
  email: string;
  role: Role;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nome, email, role')
    .eq('id', user.id)
    .single();
  return (profile as CurrentProfile) ?? null;
}

export async function requireRole(roles: Role[]): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('UNAUTHENTICATED');
  if (!roles.includes(profile.role)) throw new Error('FORBIDDEN');
  return profile;
}
