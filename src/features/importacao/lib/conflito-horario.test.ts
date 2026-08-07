import { describe, it, expect } from 'vitest';
import { detectarConflitosDeHorario, type LinhaParaConflito, type PericiaExistenteParaConflito } from './conflito-horario';

function linha(overrides: Partial<LinhaParaConflito> & Pick<LinhaParaConflito, 'linhaOriginal' | 'processoNumero'>): LinhaParaConflito {
  return {
    dataAgendada: '2026-08-10', horaAgendada: '09:00', situacao: 'marcada',
    colaboradorNomes: ['Marcelo Castro'], ...overrides,
  };
}

describe('detectarConflitosDeHorario', () => {
  it('returns no conflicts when there is nothing overlapping', () => {
    const resultado = detectarConflitosDeHorario(
      [linha({ linhaOriginal: 2, processoNumero: '0001' }), linha({ linhaOriginal: 3, processoNumero: '0002', horaAgendada: '10:00' })],
      []
    );
    expect(resultado.size).toBe(0);
  });

  it('flags the later sheet row as losing and the earlier as winning when two rows share colaborador/data/hora', () => {
    const resultado = detectarConflitosDeHorario(
      [linha({ linhaOriginal: 2, processoNumero: '0001' }), linha({ linhaOriginal: 5, processoNumero: '0002' })],
      []
    );
    expect(resultado.get(2)).toEqual([
      { colaboradorNome: 'Marcelo Castro', processoConflitante: '0002', vaiSerImportada: true, contraExistente: false },
    ]);
    expect(resultado.get(5)).toEqual([
      { colaboradorNome: 'Marcelo Castro', processoConflitante: '0001', vaiSerImportada: false, contraExistente: false },
    ]);
  });

  it('does not flag two rows for the same processo (same processo is not a conflict)', () => {
    const resultado = detectarConflitosDeHorario(
      [linha({ linhaOriginal: 2, processoNumero: '0001' }), linha({ linhaOriginal: 5, processoNumero: '0001' })],
      []
    );
    expect(resultado.size).toBe(0);
  });

  it('an existing DB pericia always wins the slot, regardless of sheet row order', () => {
    const existentes: PericiaExistenteParaConflito[] = [
      { processoNumero: '9999', dataAgendada: '2026-08-10', horaAgendada: '09:00:00', situacao: 'marcada', colaboradorNomes: ['Marcelo Castro'] },
    ];
    const resultado = detectarConflitosDeHorario([linha({ linhaOriginal: 2, processoNumero: '0001' })], existentes);
    expect(resultado.get(2)).toEqual([
      { colaboradorNome: 'Marcelo Castro', processoConflitante: '9999', vaiSerImportada: false, contraExistente: true },
    ]);
  });

  it('does not flag a conflict against an existing pericia for the same processo', () => {
    const existentes: PericiaExistenteParaConflito[] = [
      { processoNumero: '0001', dataAgendada: '2026-08-10', horaAgendada: '09:00:00', situacao: 'marcada', colaboradorNomes: ['Marcelo Castro'] },
    ];
    const resultado = detectarConflitosDeHorario([linha({ linhaOriginal: 2, processoNumero: '0001' })], existentes);
    expect(resultado.size).toBe(0);
  });

  it('ignores cancelada rows and cancelada existing pericias', () => {
    const existentes: PericiaExistenteParaConflito[] = [
      { processoNumero: '9999', dataAgendada: '2026-08-10', horaAgendada: '09:00:00', situacao: 'cancelada', colaboradorNomes: ['Marcelo Castro'] },
    ];
    const resultado = detectarConflitosDeHorario(
      [linha({ linhaOriginal: 2, processoNumero: '0001' }), linha({ linhaOriginal: 5, processoNumero: '0002', situacao: 'cancelada' })],
      existentes
    );
    expect(resultado.size).toBe(0);
  });

  it('ignores rows missing data or hora', () => {
    const resultado = detectarConflitosDeHorario(
      [
        linha({ linhaOriginal: 2, processoNumero: '0001', dataAgendada: null }),
        linha({ linhaOriginal: 5, processoNumero: '0002', horaAgendada: null }),
      ],
      []
    );
    expect(resultado.size).toBe(0);
  });

  it('handles multiple colaboradores per row independently', () => {
    const resultado = detectarConflitosDeHorario(
      [
        linha({ linhaOriginal: 2, processoNumero: '0001', colaboradorNomes: ['Marcelo Castro', 'Igor Navarro'] }),
        linha({ linhaOriginal: 5, processoNumero: '0002', colaboradorNomes: ['Igor Navarro'] }),
      ],
      []
    );
    expect(resultado.get(2)).toEqual([
      { colaboradorNome: 'Igor Navarro', processoConflitante: '0002', vaiSerImportada: true, contraExistente: false },
    ]);
    expect(resultado.get(5)).toEqual([
      { colaboradorNome: 'Igor Navarro', processoConflitante: '0001', vaiSerImportada: false, contraExistente: false },
    ]);
  });

  it('matches colaborador names case/accent-insensitively', () => {
    const resultado = detectarConflitosDeHorario(
      [
        linha({ linhaOriginal: 2, processoNumero: '0001', colaboradorNomes: ['marcelo castro'] }),
        linha({ linhaOriginal: 5, processoNumero: '0002', colaboradorNomes: ['MARCELO CASTRO'] }),
      ],
      []
    );
    expect(resultado.size).toBe(2);
  });

  it('a three-way collision flags every later row against the first winner', () => {
    const resultado = detectarConflitosDeHorario(
      [
        linha({ linhaOriginal: 2, processoNumero: '0001' }),
        linha({ linhaOriginal: 5, processoNumero: '0002' }),
        linha({ linhaOriginal: 8, processoNumero: '0003' }),
      ],
      []
    );
    expect(resultado.get(2)).toEqual([
      { colaboradorNome: 'Marcelo Castro', processoConflitante: '0002', vaiSerImportada: true, contraExistente: false },
      { colaboradorNome: 'Marcelo Castro', processoConflitante: '0003', vaiSerImportada: true, contraExistente: false },
    ]);
    expect(resultado.get(5)).toEqual([
      { colaboradorNome: 'Marcelo Castro', processoConflitante: '0001', vaiSerImportada: false, contraExistente: false },
    ]);
    expect(resultado.get(8)).toEqual([
      { colaboradorNome: 'Marcelo Castro', processoConflitante: '0001', vaiSerImportada: false, contraExistente: false },
    ]);
  });
});
