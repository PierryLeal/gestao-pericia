'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import { municipioSchema, type MunicipioInput } from './schemas';

export async function upsertMunicipio(input: MunicipioInput): Promise<MunicipioInput> {
  await requireRole(['admin', 'gerencia']);
  const parsed = municipioSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('municipios').upsert(parsed);
  if (error) throw new Error(error.message);
  return parsed;
}

export async function getMunicipioById(id: number): Promise<MunicipioInput | null> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('municipios')
    .select('id, nome, uf')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
