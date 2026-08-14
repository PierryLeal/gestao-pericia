import { z } from 'zod';

export const processoSchema = z.object({
  numero: z.string().trim().min(1, 'Número do processo é obrigatório'),
  autor: z.string().trim().min(1, 'Autor é obrigatório'),
  reu: z.string().trim().min(1, 'Réu é obrigatório'),
  escritorio: z.string().trim(),
});

export type ProcessoInput = z.infer<typeof processoSchema>;

// Used only by the bulk-import confirm flow: a spreadsheet row's PERÍCIA cell
// can name a processo número with no identifiable autor/réu (e.g. "x
// 5001234-56.2020", or a bare número) — the processo is still saved instead
// of being dropped, and the gaps are filled in later via the normal edit
// form, which still validates through the strict `processoSchema` above.
export const processoImportSchema = z.object({
  numero: z.string().trim().min(1, 'Número do processo é obrigatório'),
  autor: z.string().trim(),
  reu: z.string().trim(),
  escritorio: z.string().trim(),
});

export type ProcessoImportInput = z.infer<typeof processoImportSchema>;
