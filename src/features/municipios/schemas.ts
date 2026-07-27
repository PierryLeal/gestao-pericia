import { z } from 'zod';

export const municipioSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().trim().min(1),
  uf: z.string().length(2),
});

export type MunicipioInput = z.infer<typeof municipioSchema>;
