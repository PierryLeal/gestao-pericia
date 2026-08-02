import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CalendarioScreen } from './calendario-screen';
import type { PericiaListItem } from '../actions';

type CapturedProps = { events?: unknown[]; initialView?: string; plugins?: unknown[] };
const captured: { props: CapturedProps | null } = { props: null };

vi.mock('@fullcalendar/react', () => ({
  default: (props: CapturedProps) => {
    captured.props = props;
    return <div data-testid="fullcalendar-mock" />;
  },
}));
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));

const scheduled: PericiaListItem = {
  id: 1,
  dataAgendada: '2026-09-20',
  horaAgendada: '10:00',
  situacao: 'marcada',
  processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y' },
  municipio: { id: 3, nome: 'Belo Horizonte', uf: 'MG' },
  perito: {
    id: 7, nome: 'Cleber', contato: '', formacao: '', crea: '',
    jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
  },
  colaborador: null,
};

describe('CalendarioScreen', () => {
  it('passes the scheduled pericias as FullCalendar events, starting in month view', () => {
    render(<CalendarioScreen items={[scheduled]} />);

    expect(captured.props?.initialView).toBe('dayGridMonth');
    expect(captured.props?.events).toEqual([
      {
        id: '1',
        title: '0001234-56.2026 — Cleber',
        start: '2026-09-20T10:00',
        backgroundColor: 'var(--status-marcada)',
        borderColor: 'var(--status-marcada)',
      },
    ]);
  });
});
