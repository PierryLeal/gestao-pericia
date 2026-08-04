import { z } from 'zod';

export const colaboradorSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  contato: z.string().trim().default(''),
  formacao: z.string().trim().default(''),
});

export type ColaboradorInput = z.infer<typeof colaboradorSchema>;
