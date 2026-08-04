import { describe, it, expect } from 'vitest';
import { periciaSchema } from './schemas';

describe('periciaSchema', () => {
  it('accepts a valid pericia', () => {
    const result = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: '2026-08-01',
      horaAgendada: '14:30',
      municipioId: 3550308,
      peritoId: 1,
      colaboradorId: null,
      situacao: 'marcada',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid situacao', () => {
    const result = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: '2026-08-01',
      horaAgendada: '14:30',
      municipioId: 1,
      peritoId: 1,
      situacao: 'invalida',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed date', () => {
    const result = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: '01/08/2026',
      horaAgendada: '14:30',
      municipioId: 1,
      peritoId: 1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts null dataAgendada and horaAgendada', () => {
    const result = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: null,
      horaAgendada: null,
      municipioId: 1,
      peritoId: 1,
      colaboradorId: null,
      situacao: 'marcada',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a string observacoes and defaults it to null when omitted', () => {
    const withNote = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: '2026-08-01',
      horaAgendada: '14:30',
      municipioId: 1,
      peritoId: 1,
      colaboradorId: null,
      situacao: 'marcada',
      observacoes: 'Perícia remarcada a pedido do perito',
    });
    expect(withNote.success).toBe(true);
    expect(withNote.success && withNote.data.observacoes).toBe('Perícia remarcada a pedido do perito');

    const withoutNote = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: '2026-08-01',
      horaAgendada: '14:30',
      municipioId: 1,
      peritoId: 1,
      colaboradorId: null,
      situacao: 'marcada',
    });
    expect(withoutNote.success).toBe(true);
    expect(withoutNote.success && withoutNote.data.observacoes).toBeNull();
  });
});
