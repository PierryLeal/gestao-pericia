import { z } from 'zod';

export const situacaoOptions = ['pendente', 'marcada', 'realizada', 'cancelada'] as const;

const periciaBaseShape = {
  dataAgendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').nullable(),
  horaAgendada: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida').nullable(),
  colaboradorIds: z.array(z.number().int().positive()).default([]),
  situacao: z.enum(situacaoOptions).default('pendente'),
  observacoes: z.string().trim().nullable().default(null),
  // A processo can legitimately be worked under more than one contrato over
  // time, so this describes the specific pericia, not the lawsuit itself.
  contrato: z.string().trim().nullable().default(null),
  // The place label for this specific pericia (município's canonical name for
  // manual entries, or the sheet's raw LOCAL text for imports — a company
  // site code like "CMD" often never resolves to a real município). Used to
  // tell a genuine double-booking apart from a colaborador doing back-to-back
  // pericias for the same perito at the same place — see check_colaborador_conflito.
  local: z.string().trim().nullable().default(null),
};

export const periciaSchema = z.object({
  ...periciaBaseShape,
  processoId: z.number().int().positive('Selecione um processo'),
  municipioId: z.number().int().positive('Selecione um município'),
  peritoId: z.number().int().positive('Selecione um perito'),
});

export type PericiaInput = z.infer<typeof periciaSchema>;

// Used only by the bulk-import confirm flow: a spreadsheet row can arrive
// with no resolvable processo/município/perito, and is now saved as-is
// instead of being dropped — the manual "Nova/Editar perícia" dialogs keep
// requiring these fields via `periciaSchema` above.
export const periciaImportSchema = z.object({
  ...periciaBaseShape,
  processoId: z.number().int().positive().nullable(),
  municipioId: z.number().int().positive().nullable(),
  peritoId: z.number().int().positive().nullable(),
});

export type PericiaImportInput = z.infer<typeof periciaImportSchema>;
