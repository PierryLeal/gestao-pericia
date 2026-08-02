import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 9 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 1 } })),
  getColaboradoresIndisponiveis: vi.fn(async () => []),
}));

vi.mock('@/features/processos/components/processo-combobox', () => ({
  ProcessoCombobox: ({ selected }: { selected: { numero: string } | null }) => (
    <span>{selected ? selected.numero : 'processo vazio'}</span>
  ),
}));

vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({ selected }: { selected: { nome: string } | null }) => (
    <span>{selected ? selected.nome : 'municipio vazio'}</span>
  ),
}));

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
    render(
      <CalendarioScreen items={[scheduled]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
    );

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

  it('shows unscheduled pericias in a side list', () => {
    const unscheduled: PericiaListItem = { ...scheduled, id: 2, dataAgendada: null, horaAgendada: null };
    render(
      <CalendarioScreen
        items={[scheduled, unscheduled]}
        peritos={[{ id: 7, nome: 'Cleber' }]}
        colaboradores={[]}
        getPericiaForEdit={vi.fn()}
      />
    );

    expect(screen.getByText('Não agendadas')).toBeInTheDocument();
    expect(screen.getByText(/0001234-56.2026/)).toBeInTheDocument();
  });

  it('opens the edit dialog with the right data when a não-agendada item is clicked', async () => {
    const unscheduled: PericiaListItem = { ...scheduled, id: 2, dataAgendada: null, horaAgendada: null };
    const getPericiaForEdit = vi.fn(async () => ({
      id: 2,
      processoId: 5,
      municipioId: 3,
      peritoId: 7,
      colaboradorId: null,
      dataAgendada: null,
      horaAgendada: null,
      situacao: 'pendente' as const,
      processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y' },
      municipio: { id: 3, nome: 'Belo Horizonte', uf: 'MG' },
    }));
    const user = userEvent.setup();
    render(
      <CalendarioScreen
        items={[unscheduled]}
        peritos={[{ id: 7, nome: 'Cleber' }]}
        colaboradores={[]}
        getPericiaForEdit={getPericiaForEdit}
      />
    );

    await user.click(screen.getByText(/0001234-56.2026/));

    expect(getPericiaForEdit).toHaveBeenCalledWith(2);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Editar perícia' })).toBeInTheDocument();
  });
});
