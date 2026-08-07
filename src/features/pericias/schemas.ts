import { z } from 'zod';

export const situacaoOptions = ['pendente', 'marcada', 'realizada', 'cancelada'] as const;

export const periciaSchema = z.object({
  processoId: z.number().int().positive('Selecione um processo'),
  dataAgendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').nullable(),
  horaAgendada: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida').nullable(),
  municipioId: z.number().int().positive('Selecione um município'),
  peritoId: z.number().int().positive('Selecione um perito'),
  colaboradorIds: z.array(z.number().int().positive()).default([]),
  situacao: z.enum(situacaoOptions).default('pendente'),
  observacoes: z.string().trim().nullable().default(null),
});

export type PericiaInput = z.infer<typeof periciaSchema>;
