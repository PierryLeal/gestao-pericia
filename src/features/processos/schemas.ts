import { z } from 'zod';

export const processoSchema = z.object({
  numero: z.string().trim().min(1, 'Número do processo é obrigatório'),
  autor: z.string().trim().min(1, 'Autor é obrigatório'),
  reu: z.string().trim().min(1, 'Réu é obrigatório'),
  escritorio: z.string().trim().min(1, 'Escritório é obrigatório'),
});

export type ProcessoInput = z.infer<typeof processoSchema>;
