import { z } from 'zod';

export const relacaoOptions = ['ruim', 'neutra', 'boa', 'otima'] as const;
export const resultadoOptions = ['negativo', 'parcial', 'positivo'] as const;

export const peritoSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  contato: z.string().trim().default(''),
  formacao: z.string().trim().default(''),
  crea: z.string().trim().default(''),
  documento: z.string().trim().default(''),
  jaTrabalhamos: z.boolean().default(false),
  relacao: z.enum(relacaoOptions).default('neutra'),
  resultados: z.enum(resultadoOptions).default('parcial'),
});

export type PeritoInput = z.infer<typeof peritoSchema>;
