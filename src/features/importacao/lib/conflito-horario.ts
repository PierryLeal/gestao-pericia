import { normalizeForSearch } from '@/lib/search';

export type LinhaParaConflito = {
  linhaOriginal: number;
  processoNumero: string;
  dataAgendada: string | null;
  horaAgendada: string | null;
  situacao: string;
  colaboradorNomes: string[];
};

export type PericiaExistenteParaConflito = {
  processoNumero: string;
  dataAgendada: string | null;
  horaAgendada: string | null;
  situacao: string;
  colaboradorNomes: string[];
};

export type ConflitoDeHorario = {
  colaboradorNome: string;
  processoConflitante: string;
  /** false when this row will be rejected by the double-booking check on confirm. */
  vaiSerImportada: boolean;
  /** true when the conflict is against a pericia already saved in the system,
   *  as opposed to another row in this same sheet. */
  contraExistente: boolean;
};

function chaveSlot(colaboradorNome: string, dataAgendada: string, horaAgendada: string): string {
  // Truncate to HH:MM: the DB's `time` column round-trips with seconds
  // ("HH:MM:SS") while a freshly parsed sheet cell is "HH:MM" — mirrors the
  // same truncation chavePericia() uses for the same reason.
  return JSON.stringify([normalizeForSearch(colaboradorNome), dataAgendada, horaAgendada.slice(0, 5)]);
}

/**
 * Predicts, at preview time, which rows will collide with the double-booking
 * check the database enforces on confirm (same colaborador, same data/hora,
 * different processo, neither cancelada) — so the user can see and fix it
 * before confirming instead of discovering it in the post-import error list.
 *
 * A pericia already saved in the system always "wins" a slot (it's already
 * committed). Among sheet rows contending for the same slot, the earliest
 * row in the sheet is predicted to win, mirroring the order rows are
 * dispatched for creation in confirmarImportacaoPericias.
 */
export function detectarConflitosDeHorario(
  linhas: LinhaParaConflito[],
  existentes: PericiaExistenteParaConflito[]
): Map<number, ConflitoDeHorario[]> {
  const resultado = new Map<number, ConflitoDeHorario[]>();
  function adicionar(linhaOriginal: number, conflito: ConflitoDeHorario) {
    const atuais = resultado.get(linhaOriginal) ?? [];
    atuais.push(conflito);
    resultado.set(linhaOriginal, atuais);
  }

  // Whoever currently "occupies" a slot — an existing DB pericia always claims
  // its slot up front, since it can't be displaced by anything in this import.
  const ocupantes = new Map<string, { processoNumero: string; existente: boolean; linhaOriginal?: number }>();

  for (const existente of existentes) {
    if (existente.situacao === 'cancelada') continue;
    if (!existente.dataAgendada || !existente.horaAgendada) continue;
    for (const nome of existente.colaboradorNomes) {
      const slot = chaveSlot(nome, existente.dataAgendada, existente.horaAgendada);
      if (!ocupantes.has(slot)) {
        ocupantes.set(slot, { processoNumero: existente.processoNumero, existente: true });
      }
    }
  }

  for (const linha of linhas) {
    if (linha.situacao === 'cancelada') continue;
    if (!linha.dataAgendada || !linha.horaAgendada) continue;
    for (const nome of linha.colaboradorNomes) {
      const slot = chaveSlot(nome, linha.dataAgendada, linha.horaAgendada);
      const ocupante = ocupantes.get(slot);

      if (!ocupante) {
        ocupantes.set(slot, { processoNumero: linha.processoNumero, existente: false, linhaOriginal: linha.linhaOriginal });
        continue;
      }
      if (normalizeForSearch(ocupante.processoNumero) === normalizeForSearch(linha.processoNumero)) {
        // Same processo isn't a real conflict — matches the DB trigger's own rule.
        continue;
      }

      adicionar(linha.linhaOriginal, {
        colaboradorNome: nome, processoConflitante: ocupante.processoNumero,
        vaiSerImportada: false, contraExistente: ocupante.existente,
      });

      // Tell the row that's currently winning the slot, too — but only if the
      // winner is another sheet row (an existing DB pericia doesn't need a
      // heads-up, it's not part of this import).
      if (!ocupante.existente && ocupante.linhaOriginal !== undefined) {
        const jaAnotado = (resultado.get(ocupante.linhaOriginal) ?? []).some(
          (c) => c.colaboradorNome === nome && c.processoConflitante === linha.processoNumero
        );
        if (!jaAnotado) {
          adicionar(ocupante.linhaOriginal, {
            colaboradorNome: nome, processoConflitante: linha.processoNumero,
            vaiSerImportada: true, contraExistente: false,
          });
        }
      }
    }
  }

  return resultado;
}
