import { describe, it, expect } from 'vitest';
import { periciaToEvent, splitAgendadasNaoAgendadas, formatDateLocal, formatTimeLocal } from './calendario-mapping';
import type { PericiaListItem } from '../actions';

const scheduled: PericiaListItem = {
  id: 1,
  dataAgendada: '2026-09-20',
  horaAgendada: '10:00',
  situacao: 'marcada',
  observacoes: null,
  processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y', escritorio: 'PMRA' },
  municipio: { id: 3, nome: 'Belo Horizonte', uf: 'MG' },
  perito: {
    id: 7, nome: 'Cleber', contato: '', formacao: '', crea: '',
    jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
  },
  colaborador: null,
};

describe('periciaToEvent', () => {
  it('maps a scheduled pericia to a FullCalendar event colored by situação', () => {
    expect(periciaToEvent(scheduled)).toEqual({
      id: '1',
      title: '0001234-56.2026 — Cleber',
      start: '2026-09-20T10:00',
      backgroundColor: 'var(--status-marcada)',
      borderColor: 'var(--status-marcada)',
      extendedProps: {
        processoNumero: '0001234-56.2026',
        peritoNome: 'Cleber',
        colaboradorNome: null,
        municipioNome: 'Belo Horizonte',
        municipioUf: 'MG',
        horaAgendada: '10:00',
        situacao: 'marcada',
      },
    });
  });

  it('uses a different color per situação', () => {
    expect(periciaToEvent({ ...scheduled, situacao: 'cancelada' }).backgroundColor).toBe('var(--status-cancelada)');
  });
});

describe('splitAgendadasNaoAgendadas', () => {
  it('puts pericias with both data and hora into events, leaves the rest unscheduled', () => {
    const semData: PericiaListItem = { ...scheduled, id: 2, dataAgendada: null, horaAgendada: null };
    const { events, unscheduled } = splitAgendadasNaoAgendadas([scheduled, semData]);
    expect(events).toEqual([periciaToEvent(scheduled)]);
    expect(unscheduled).toEqual([semData]);
  });

  it('treats a pericia with only data or only hora as unscheduled', () => {
    const soData: PericiaListItem = { ...scheduled, id: 3, horaAgendada: null };
    const { events, unscheduled } = splitAgendadasNaoAgendadas([soData]);
    expect(events).toEqual([]);
    expect(unscheduled).toEqual([soData]);
  });
});

describe('formatDateLocal / formatTimeLocal', () => {
  it('formats using local getters, not UTC', () => {
    const date = new Date(2026, 8, 20, 9, 5); // month is 0-indexed: September 20, 2026, 09:05 local
    expect(formatDateLocal(date)).toBe('2026-09-20');
    expect(formatTimeLocal(date)).toBe('09:05');
  });
});
