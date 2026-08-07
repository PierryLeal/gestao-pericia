import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalendarioScreen } from './calendario-screen';
import type { PericiaListItem } from '../actions';

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

type CapturedProps = {
  events?: unknown[];
  initialView?: string;
  plugins?: unknown[];
  locale?: unknown;
  headerToolbar?: { left: string; center: string; right: string };
  eventClick?: (info: { event: { id: string } }) => void | Promise<void>;
  eventDrop?: (info: { event: { id: string; start: Date }; revert: () => void }) => void | Promise<void>;
  eventReceive?: (info: { event: { id: string; start: Date }; revert: () => void }) => void | Promise<void>;
};
const captured: { props: CapturedProps | null } = { props: null };

vi.mock('@fullcalendar/react', () => ({
  default: (props: CapturedProps) => {
    captured.props = props;
    return <div data-testid="fullcalendar-mock" />;
  },
}));
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }));

const mockUpdatePericia = vi.fn();
const mockGetColaboradoresIndisponiveis = vi.fn();
vi.mock('../actions', async () => {
  const actual = await vi.importActual('../actions');
  return {
    ...actual,
    updatePericia: (...args: unknown[]) => mockUpdatePericia(...args),
    getColaboradoresIndisponiveis: (...args: unknown[]) => mockGetColaboradoresIndisponiveis(...args),
  };
});

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

const mockDraggableConstructor = vi.fn();
const mockDraggableDestroy = vi.fn();
vi.mock('@fullcalendar/interaction', () => ({
  default: {},
  Draggable: class {
    constructor(...args: unknown[]) {
      mockDraggableConstructor(...args);
    }
    destroy() {
      mockDraggableDestroy();
    }
  },
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
  observacoes: null,
  processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y', escritorio: 'PMRA' },
  municipio: { id: 3, nome: 'Belo Horizonte', uf: 'MG' },
  perito: {
    id: 7, nome: 'Cleber', contato: '', formacao: '', crea: '',
    jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
  },
  colaboradores: [],
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
        extendedProps: {
          processoNumero: '0001234-56.2026',
          peritoNome: 'Cleber',
          colaboradorNome: null,
          municipioNome: 'Belo Horizonte',
          municipioUf: 'MG',
          horaAgendada: '10:00',
          situacao: 'marcada',
        },
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
      colaboradorIds: [],
      dataAgendada: null,
      horaAgendada: null,
      situacao: 'pendente' as const,
      observacoes: null,
      processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y', escritorio: 'PMRA' },
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

  describe('drag-to-reschedule', () => {
    const withColaborador: PericiaListItem = {
      ...scheduled,
      colaboradores: [{ id: 9, nome: 'Ana', contato: '', formacao: '' }],
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('registers a Draggable source for the não-agendadas list on mount', () => {
      render(
        <CalendarioScreen items={[scheduled]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
      );

      expect(mockDraggableConstructor).toHaveBeenCalledTimes(1);
      const [, settings] = mockDraggableConstructor.mock.calls[0];
      expect(settings.itemSelector).toBe('.calendario-nao-agendada-item');

      const el = document.createElement('div');
      el.dataset.periciaId = '7';
      el.dataset.title = 'X';
      expect(settings.eventData(el)).toEqual({ id: '7', title: 'X' });
    });

    it('reverts and shows an error toast when getColaboradoresIndisponiveis throws', async () => {
      mockGetColaboradoresIndisponiveis.mockRejectedValue(new Error('boom'));
      render(
        <CalendarioScreen
          items={[withColaborador]}
          peritos={[]}
          colaboradores={[]}
          getPericiaForEdit={vi.fn()}
        />
      );

      const revert = vi.fn();
      await captured.props?.eventDrop?.({
        event: { id: '1', start: new Date(2026, 9, 5, 11, 0) },
        revert,
      });

      expect(revert).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith('Não foi possível reagendar a perícia.');
    });

    it('reverts and shows an error toast when updatePericia throws', async () => {
      mockUpdatePericia.mockRejectedValue(new Error('boom'));
      render(
        <CalendarioScreen items={[scheduled]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
      );

      const revert = vi.fn();
      await captured.props?.eventDrop?.({
        event: { id: '1', start: new Date(2026, 9, 5, 11, 0) },
        revert,
      });

      expect(revert).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith('Não foi possível reagendar a perícia.');
    });

    it('reverts and shows an error toast when moving an existing event would create a colaborador conflict', async () => {
      mockGetColaboradoresIndisponiveis.mockResolvedValue([9]);
      render(
        <CalendarioScreen
          items={[withColaborador]}
          peritos={[]}
          colaboradores={[]}
          getPericiaForEdit={vi.fn()}
        />
      );

      const revert = vi.fn();
      await captured.props?.eventDrop?.({
        event: { id: '1', start: new Date(2026, 9, 5, 11, 0) },
        revert,
      });

      expect(mockGetColaboradoresIndisponiveis).toHaveBeenCalledWith('2026-10-05', '11:00', 1);
      expect(revert).toHaveBeenCalled();
      expect(mockUpdatePericia).not.toHaveBeenCalled();
    });

    it('updates the pericia and refreshes when moving an existing event has no conflict', async () => {
      mockGetColaboradoresIndisponiveis.mockResolvedValue([]);
      mockUpdatePericia.mockResolvedValue({ success: true, data: { id: 1 } });
      render(
        <CalendarioScreen
          items={[withColaborador]}
          peritos={[]}
          colaboradores={[]}
          getPericiaForEdit={vi.fn()}
        />
      );

      const revert = vi.fn();
      await captured.props?.eventDrop?.({
        event: { id: '1', start: new Date(2026, 9, 5, 11, 0) },
        revert,
      });

      expect(mockUpdatePericia).toHaveBeenCalledWith(1, {
        processoId: 5,
        municipioId: 3,
        peritoId: 7,
        colaboradorIds: [9],
        dataAgendada: '2026-10-05',
        horaAgendada: '11:00',
        situacao: 'marcada',
        observacoes: null,
      });
      expect(revert).not.toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('skips the conflict check entirely when the pericia has no colaborador', async () => {
      mockUpdatePericia.mockResolvedValue({ success: true, data: { id: 1 } });
      render(
        <CalendarioScreen items={[scheduled]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
      );

      await captured.props?.eventDrop?.({
        event: { id: '1', start: new Date(2026, 9, 5, 11, 0) },
        revert: vi.fn(),
      });

      expect(mockGetColaboradoresIndisponiveis).not.toHaveBeenCalled();
      expect(mockUpdatePericia).toHaveBeenCalled();
    });

    it('reverts a não-agendada drop onto the calendar when it would create a conflict', async () => {
      const semData: PericiaListItem = { ...withColaborador, id: 2, dataAgendada: null, horaAgendada: null };
      mockGetColaboradoresIndisponiveis.mockResolvedValue([9]);
      render(
        <CalendarioScreen items={[semData]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
      );

      const revert = vi.fn();
      await captured.props?.eventReceive?.({
        event: { id: '2', start: new Date(2026, 9, 5, 11, 0) },
        revert,
      });

      expect(revert).toHaveBeenCalled();
      expect(mockUpdatePericia).not.toHaveBeenCalled();
    });

    it('schedules a não-agendada pericia when dropped onto the calendar with no conflict', async () => {
      const semData: PericiaListItem = { ...scheduled, id: 2, dataAgendada: null, horaAgendada: null };
      mockUpdatePericia.mockResolvedValue({ success: true, data: { id: 2 } });
      render(
        <CalendarioScreen items={[semData]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
      );

      await captured.props?.eventReceive?.({
        event: { id: '2', start: new Date(2026, 9, 5, 11, 0) },
        revert: vi.fn(),
      });

      expect(mockUpdatePericia).toHaveBeenCalledWith(2, expect.objectContaining({
        dataAgendada: '2026-10-05',
        horaAgendada: '11:00',
      }));
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('reduces both the calendar events and the não-agendadas list when a filter is applied', async () => {
    const other: PericiaListItem = {
      ...scheduled,
      id: 2,
      dataAgendada: null,
      horaAgendada: null,
      perito: { ...scheduled.perito, id: 8, nome: 'Outro Perito' },
    };
    const user = userEvent.setup();
    render(
      <CalendarioScreen
        items={[scheduled, other]}
        peritos={[{ id: 7, nome: 'Cleber' }, { id: 8, nome: 'Outro Perito' }]}
        colaboradores={[]}
        getPericiaForEdit={vi.fn()}
      />
    );

    expect(captured.props?.events).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Outro Perito/ })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByRole('option', { name: 'Cleber' }));

    expect(captured.props?.events).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Outro Perito/ })).not.toBeInTheDocument();
  });

  it('reduces both the calendar events and the não-agendadas list when filtering by situação', async () => {
    const pendenteAgendada: PericiaListItem = {
      ...scheduled,
      id: 2,
      situacao: 'pendente',
      processo: { ...scheduled.processo, id: 6, numero: '0009999-99.2026' },
    };
    const pendenteNaoAgendada: PericiaListItem = {
      ...scheduled,
      id: 3,
      situacao: 'pendente',
      dataAgendada: null,
      horaAgendada: null,
      processo: { ...scheduled.processo, id: 10, numero: '0005555-55.2026' },
    };
    const user = userEvent.setup();
    render(
      <CalendarioScreen
        items={[scheduled, pendenteAgendada, pendenteNaoAgendada]}
        peritos={[{ id: 7, nome: 'Cleber' }]}
        colaboradores={[]}
        getPericiaForEdit={vi.fn()}
      />
    );

    expect(captured.props?.events).toHaveLength(2);
    expect(screen.getByRole('button', { name: /0005555-55.2026/ })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /situação/i }));
    await user.click(await screen.findByRole('option', { name: 'marcada' }));

    expect(captured.props?.events).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /0005555-55.2026/ })).not.toBeInTheDocument();
  });

  it('reduces both the calendar events and the não-agendadas list when filtering by colaborador', async () => {
    const colaboradorA = { id: 9, nome: 'Ana', contato: '', formacao: '' };
    const colaboradorB = { id: 10, nome: 'Bruno', contato: '', formacao: '' };
    const comColaboradorA: PericiaListItem = { ...scheduled, colaboradores: [colaboradorA] };
    const comColaboradorB: PericiaListItem = {
      ...scheduled,
      id: 2,
      colaboradores: [colaboradorB],
      processo: { ...scheduled.processo, id: 6, numero: '0009999-99.2026' },
    };
    const naoAgendadaColaboradorB: PericiaListItem = {
      ...scheduled,
      id: 3,
      colaboradores: [colaboradorB],
      dataAgendada: null,
      horaAgendada: null,
      processo: { ...scheduled.processo, id: 10, numero: '0005555-55.2026' },
    };
    const user = userEvent.setup();
    render(
      <CalendarioScreen
        items={[comColaboradorA, comColaboradorB, naoAgendadaColaboradorB]}
        peritos={[]}
        colaboradores={[colaboradorA, colaboradorB]}
        getPericiaForEdit={vi.fn()}
      />
    );

    expect(captured.props?.events).toHaveLength(2);
    expect(screen.getByRole('button', { name: /0005555-55.2026/ })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    await user.click(await screen.findByRole('option', { name: 'Ana' }));

    expect(captured.props?.events).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /0005555-55.2026/ })).not.toBeInTheDocument();
  });

  it('offers month/week/day view buttons in the header toolbar', () => {
    render(
      <CalendarioScreen items={[scheduled]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
    );

    expect(captured.props?.headerToolbar).toEqual({
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    });
    expect(captured.props?.plugins).toEqual(
      expect.arrayContaining([expect.anything(), expect.anything(), expect.anything()])
    );
  });

  it('renders with a Portuguese (pt-BR) locale', () => {
    render(
      <CalendarioScreen items={[scheduled]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
    );

    expect(captured.props?.locale).toBeDefined();
  });

  it('opens the edit dialog with the right pericia when a calendar event is clicked', async () => {
    const getPericiaForEdit = vi.fn(async () => ({
      id: 1,
      processoId: 5,
      municipioId: 3,
      peritoId: 7,
      colaboradorIds: [],
      dataAgendada: '2026-09-20',
      horaAgendada: '10:00',
      situacao: 'marcada' as const,
      observacoes: null,
      processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y', escritorio: 'PMRA' },
      municipio: { id: 3, nome: 'Belo Horizonte', uf: 'MG' },
    }));
    render(
      <CalendarioScreen
        items={[scheduled]}
        peritos={[{ id: 7, nome: 'Cleber' }]}
        colaboradores={[]}
        getPericiaForEdit={getPericiaForEdit}
      />
    );

    await captured.props?.eventClick?.({ event: { id: '1' } });

    expect(getPericiaForEdit).toHaveBeenCalledWith(1);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
