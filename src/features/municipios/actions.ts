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
