import { z } from 'zod';

export const peritoSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  contato: z.string().trim().default(''),
  formacao: z.string().trim().default(''),
  crea: z.string().trim().default(''),
  documento: z.string().trim().default(''),
  jaTrabalhamos: z.boolean().default(false),
  relacao: z.number().int().min(0).max(10).default(0),
  resultados: z.number().int().min(0).max(10).default(0),
});

export type PeritoInput = z.infer<typeof peritoSchema>;
