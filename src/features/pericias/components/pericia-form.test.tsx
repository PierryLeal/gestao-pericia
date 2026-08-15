import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PericiaForm } from './pericia-form';
import { createPericia, updatePericia, getColaboradoresIndisponiveis } from '../actions';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';

const mockToastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: vi.fn(),
  },
}));

vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  getColaboradoresIndisponiveis: vi.fn(async () => []),
  listContratosDistintos: vi.fn(async () => []),
}));

vi.mock('@/features/processos/components/processo-combobox', () => ({
  ProcessoCombobox: ({ onChange, onNovoProcesso }: { onChange: (p: Processo) => void; onNovoProcesso: () => void }) => (
    <>
      <button
        type="button"
        onClick={() => onChange({ id: 1, numero: 'P-1', autor: 'A', reu: 'B', escritorio: 'PMRA' })}
      >
        selecionar processo
      </button>
      <button type="button" onClick={onNovoProcesso}>novo processo</button>
    </>
  ),
}));

vi.mock('@/features/processos/components/processo-form', () => ({
  ProcessoForm: ({ onSaved }: { onSaved: (p: Processo) => void }) => (
    <button
      type="button"
      onClick={() => onSaved({ id: 9, numero: 'NOVO-1', autor: 'X', reu: 'Y', escritorio: '' })}
    >
      salvar novo processo
    </button>
  ),
}));

vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({ onChange }: { onChange: (m: MunicipioIBGE) => void }) => (
    <button type="button" onClick={() => onChange({ id: 3550308, nome: 'São Paulo', uf: 'SP' })}>
      selecionar município
    </button>
  ),
}));

describe('PericiaForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToastSuccess.mockClear();
  });

  it('calls onError when processo, municipio, or perito are missing', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={onError} />);

    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(onError).toHaveBeenCalledWith('Preencha processo, município e perito.');
  });

  it('calls onSaved with the id once processo, municipio, and perito are set', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={onSaved} onError={vi.fn()} />);

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.type(screen.getByLabelText('Data agendada'), '2026-08-01');
    await user.type(screen.getByLabelText('Hora agendada'), '14:30');
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(onSaved).toHaveBeenCalledWith(5);
  });

  it('lets the user clear a selected colaborador back to none', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={onSaved}
        onError={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    await user.click(await screen.findByText('Bruna'));

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    await user.click(await screen.findByText('Nenhum'));

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(onSaved).toHaveBeenCalledWith(5);
  });

  it('saves successfully when dataAgendada and horaAgendada are left empty', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={onSaved} onError={vi.fn()} />
    );

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(onSaved).toHaveBeenCalledWith(5);
  });

  it('dims a colaborador already booked at the selected date/time but keeps it clickable, and blocks save if chosen', async () => {
    vi.mocked(getColaboradoresIndisponiveis).mockResolvedValue([2]);
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }, { id: 3, nome: 'Duda' }]}
        onSaved={onSaved}
        onError={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('Data agendada'), '2026-08-10');
    await user.type(screen.getByLabelText('Hora agendada'), '14:00');
    await new Promise((r) => setTimeout(r, 350));

    expect(getColaboradoresIndisponiveis).toHaveBeenCalledWith('2026-08-10', '14:00', undefined, undefined, undefined, undefined, 'pendente');

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    const busyOption = await screen.findByRole('option', { name: 'Bruna' });
    expect(busyOption.className).toMatch(/opacity-40/);
    await user.click(busyOption);

    expect(
      await screen.findByText('Bruna já está atribuído a outra perícia nesse mesmo dia e horário.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar perícia/i })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('includes the selected processo id in the conflict check once a processo is chosen', async () => {
    const user = userEvent.setup();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );

    await user.click(screen.getByText('selecionar processo'));
    await user.type(screen.getByLabelText('Data agendada'), '2026-08-10');
    await user.type(screen.getByLabelText('Hora agendada'), '14:00');
    await new Promise((r) => setTimeout(r, 350));

    expect(getColaboradoresIndisponiveis).toHaveBeenCalledWith('2026-08-10', '14:00', 1, undefined, undefined, undefined, 'pendente');
  });

  it('does not restrict the colaborador select when no date/time is set', async () => {
    const user = userEvent.setup();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    const option = await screen.findByRole('option', { name: 'Bruna' });
    expect(option.className ?? '').not.toMatch(/opacity-40/);

    expect(getColaboradoresIndisponiveis).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /salvar perícia/i })).not.toBeDisabled();
  });

  it('flags the conflict retroactively when a date/time is filled in after a colaborador was already selected', async () => {
    vi.mocked(getColaboradoresIndisponiveis).mockResolvedValue([2]);
    const user = userEvent.setup();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    await user.click(await screen.findByText('Bruna'));
    expect(screen.getByRole('button', { name: /salvar perícia/i })).not.toBeDisabled();

    await user.type(screen.getByLabelText('Data agendada'), '2026-08-10');
    await user.type(screen.getByLabelText('Hora agendada'), '14:00');
    await new Promise((r) => setTimeout(r, 350));

    expect(
      await screen.findByText('Bruna já está atribuído a outra perícia nesse mesmo dia e horário.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar perícia/i })).toBeDisabled();
  });

  it('clears the conflict and re-enables save when the date is cleared', async () => {
    vi.mocked(getColaboradoresIndisponiveis).mockResolvedValue([2]);
    const user = userEvent.setup();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('Data agendada'), '2026-08-10');
    await user.type(screen.getByLabelText('Hora agendada'), '14:00');
    await new Promise((r) => setTimeout(r, 350));
    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    await user.click(await screen.findByText('Bruna'));
    expect(screen.getByRole('button', { name: /salvar perícia/i })).toBeDisabled();

    await user.clear(screen.getByLabelText('Data agendada'));

    expect(
      screen.queryByText('Bruna já está atribuído a outra perícia nesse mesmo dia e horário.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar perícia/i })).not.toBeDisabled();
  });

  it('passes the pericia id to exclude itself from the conflict check when editing', async () => {
    vi.mocked(getColaboradoresIndisponiveis).mockResolvedValue([]);
    render(
      <PericiaForm
        pericia={{
          id: 9,
          processoId: 1,
          municipioId: 3550308,
          peritoId: 1,
          colaboradorIds: [2],
          dataAgendada: '2026-08-10',
          horaAgendada: '14:00',
          situacao: 'marcada',
          observacoes: null,
          contrato: null,
          local: null,
          processo: { id: 1, numero: 'P-1', autor: 'A', reu: 'B', escritorio: 'PMRA' },
          municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
        }}
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );

    await new Promise((r) => setTimeout(r, 350));

    expect(getColaboradoresIndisponiveis).toHaveBeenCalledWith('2026-08-10', '14:00', 1, 9, 1, 'São Paulo', 'marcada');
  });

  it('surfaces an error via onError when the conflict check fails', async () => {
    vi.mocked(getColaboradoresIndisponiveis).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    const onError = vi.fn();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={vi.fn()}
        onError={onError}
      />
    );

    await user.type(screen.getByLabelText('Data agendada'), '2026-08-10');
    await user.type(screen.getByLabelText('Hora agendada'), '14:00');
    await new Promise((r) => setTimeout(r, 350));

    expect(onError).toHaveBeenCalledWith('Não foi possível verificar conflitos de horário.');
  });

  it('ignores a stale response from an earlier, now-abandoned request when a later request resolves first', async () => {
    // First call (triggered by the initial Data/Hora fill) is slow and would report
    // colaborador 2 as busy. Second call (triggered by changing Hora again before the
    // first request settles) is fast and reports colaborador 3 as busy instead. The
    // UI must end up reflecting only the second, later-triggered request.
    vi.mocked(getColaboradoresIndisponiveis)
      .mockImplementationOnce(async () => {
        await new Promise((r) => setTimeout(r, 700));
        return [2];
      })
      .mockImplementationOnce(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return [3];
      });

    const user = userEvent.setup();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[
          { id: 2, nome: 'Bruna' },
          { id: 3, nome: 'Duda' },
        ]}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('Data agendada'), '2026-08-10');
    await user.type(screen.getByLabelText('Hora agendada'), '14:00');
    // Let the debounce fire and the first (slow) request start.
    await new Promise((r) => setTimeout(r, 400));

    await user.clear(screen.getByLabelText('Hora agendada'));
    await user.type(screen.getByLabelText('Hora agendada'), '15:00');
    // Let the debounce fire, the second (fast) request start and resolve, and give
    // the first (slow, now-abandoned) request enough time to resolve as well —
    // its result must be discarded because the effect that issued it was cancelled.
    await new Promise((r) => setTimeout(r, 900));

    expect(getColaboradoresIndisponiveis).toHaveBeenCalledTimes(2);
    expect(getColaboradoresIndisponiveis).toHaveBeenNthCalledWith(1, '2026-08-10', '14:00', undefined, undefined, undefined, undefined, 'pendente');
    expect(getColaboradoresIndisponiveis).toHaveBeenNthCalledWith(2, '2026-08-10', '15:00', undefined, undefined, undefined, undefined, 'pendente');

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    const brunaOption = await screen.findByRole('option', { name: 'Bruna' });
    const dudaOption = await screen.findByRole('option', { name: 'Duda' });

    // Stale response from the abandoned first request (colaborador 2) must not apply.
    expect(brunaOption.className ?? '').not.toMatch(/opacity-40/);
    // Result of the latest request (colaborador 3) must apply.
    expect(dudaOption.className).toMatch(/opacity-40/);
  }, 10000);

  it('sends a trimmed observacoes value, or null when left blank', async () => {
    const user = userEvent.setup();
    render(
      <PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={vi.fn()} />
    );

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.type(screen.getByLabelText('Observações'), '  Levar EPI extra  ');
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(vi.mocked(createPericia)).toHaveBeenCalledWith(
      expect.objectContaining({ observacoes: 'Levar EPI extra' })
    );
  });

  it('sends observacoes as null when left blank', async () => {
    const user = userEvent.setup();
    render(
      <PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={vi.fn()} />
    );

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(vi.mocked(createPericia)).toHaveBeenCalledWith(expect.objectContaining({ observacoes: null }));
  });

  describe('multiple colaboradores', () => {
    const colaboradores = [
      { id: 2, nome: 'Bruna' },
      { id: 3, nome: 'Duda' },
    ];

    it('starts with a single colaborador row showing only a "+" button', () => {
      render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={colaboradores} onSaved={vi.fn()} onError={vi.fn()} />);

      expect(screen.getByRole('combobox', { name: 'Colaborador 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /adicionar outro colaborador/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /remover colaborador/i })).not.toBeInTheDocument();
    });

    it('adds a new empty row on "+", turning the first row\'s button into a trash icon', async () => {
      const user = userEvent.setup();
      render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={colaboradores} onSaved={vi.fn()} onError={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /adicionar outro colaborador/i }));

      expect(screen.getByRole('combobox', { name: 'Colaborador 1' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Colaborador 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remover colaborador 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /adicionar outro colaborador/i })).toBeInTheDocument();
    });

    it('sends every selected colaborador id on save', async () => {
      const user = userEvent.setup();
      render(
        <PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={colaboradores} onSaved={vi.fn()} onError={vi.fn()} />
      );

      await user.click(screen.getByRole('combobox', { name: 'Colaborador 1' }));
      await user.click(await screen.findByText('Bruna'));
      await user.click(screen.getByRole('button', { name: /adicionar outro colaborador/i }));
      await user.click(screen.getByRole('combobox', { name: 'Colaborador 2' }));
      await user.click(await screen.findByRole('option', { name: 'Duda' }));

      await user.click(screen.getByText('selecionar processo'));
      await user.click(screen.getByText('selecionar município'));
      await user.click(screen.getByRole('combobox', { name: /perito/i }));
      await user.click(await screen.findByText('Carlos'));
      await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

      expect(vi.mocked(createPericia)).toHaveBeenCalledWith(
        expect.objectContaining({ colaboradorIds: [2, 3] })
      );
    });

    it('removes a row when its trash icon is clicked, keeping the other row\'s value', async () => {
      const user = userEvent.setup();
      render(
        <PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={colaboradores} onSaved={vi.fn()} onError={vi.fn()} />
      );

      await user.click(screen.getByRole('combobox', { name: 'Colaborador 1' }));
      await user.click(await screen.findByText('Bruna'));
      await user.click(screen.getByRole('button', { name: /adicionar outro colaborador/i }));
      await user.click(screen.getByRole('combobox', { name: 'Colaborador 2' }));
      await user.click(await screen.findByRole('option', { name: 'Duda' }));

      await user.click(screen.getByRole('button', { name: /remover colaborador 1/i }));

      expect(screen.queryByRole('combobox', { name: 'Colaborador 2' })).not.toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Colaborador 1' })).toHaveTextContent('Duda');
    });

    it('does not offer a colaborador already picked in another row', async () => {
      const user = userEvent.setup();
      render(
        <PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={colaboradores} onSaved={vi.fn()} onError={vi.fn()} />
      );

      await user.click(screen.getByRole('combobox', { name: 'Colaborador 1' }));
      await user.click(await screen.findByText('Bruna'));
      await user.click(screen.getByRole('button', { name: /adicionar outro colaborador/i }));

      await user.click(screen.getByRole('combobox', { name: 'Colaborador 2' }));
      expect(await screen.findByRole('option', { name: 'Duda' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Bruna' })).not.toBeInTheDocument();
    });
  });

  describe('editing an incomplete pericia', () => {
    const incompleta = {
      id: 9,
      processoId: null,
      municipioId: null,
      peritoId: null,
      colaboradorIds: [] as number[],
      dataAgendada: null,
      horaAgendada: null,
      situacao: 'pendente' as const,
      observacoes: null,
      contrato: null,
      local: null,
      processo: null,
      municipio: null,
    };

    it('saves without blocking even though processo, município, and perito are still missing', async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      const onError = vi.fn();
      render(
        <PericiaForm pericia={incompleta} peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={onSaved} onError={onError} />
      );

      await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

      expect(onError).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledWith(5);
    });

    it('sends null for processoId/municipioId/peritoId that were never filled in', async () => {
      const user = userEvent.setup();
      render(
        <PericiaForm pericia={incompleta} peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={vi.fn()} />
      );

      await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

      expect(vi.mocked(updatePericia)).toHaveBeenCalledWith(
        9,
        expect.objectContaining({ processoId: null, municipioId: null, peritoId: null })
      );
    });
  });

  describe('criar novo processo from within the pericia form', () => {
    it('swaps to the novo-processo form in place instead of opening a nested dialog', async () => {
      const user = userEvent.setup();
      render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={vi.fn()} />);

      await user.click(screen.getByText('novo processo'));

      // The pericia's own form fields are gone while the processo form is showing —
      // there is only ever one form on screen, never two dialogs stacked.
      expect(screen.queryByLabelText('Observações')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /salvar perícia/i })).not.toBeInTheDocument();
      expect(screen.getByText('salvar novo processo')).toBeInTheDocument();
    });

    it('returns to the pericia form with earlier field values intact after creating a processo', async () => {
      const user = userEvent.setup();
      render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={vi.fn()} />);

      await user.type(screen.getByLabelText('Observações'), 'não perder isso');
      await user.click(screen.getByText('novo processo'));
      await user.click(screen.getByText('salvar novo processo'));

      expect(screen.getByLabelText('Observações')).toHaveValue('não perder isso');
      expect(mockToastSuccess).toHaveBeenCalledWith('Processo criado com sucesso');
    });

    it('returns to the pericia form via "Voltar" without creating a processo, keeping field values', async () => {
      const user = userEvent.setup();
      render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={vi.fn()} />);

      await user.type(screen.getByLabelText('Observações'), 'não perder isso');
      await user.click(screen.getByText('novo processo'));
      await user.click(screen.getByRole('button', { name: /voltar para a perícia/i }));

      expect(screen.getByLabelText('Observações')).toHaveValue('não perder isso');
    });

    it('does not submit the pericia form when the nested processo form is saved (no stray validation toast)', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();
      // No processo/município/perito selected — if the outer form's submit ever
      // fired too, this would call onError with the "missing fields" message.
      render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={onError} />);

      await user.click(screen.getByText('novo processo'));
      await user.click(screen.getByText('salvar novo processo'));

      expect(onError).not.toHaveBeenCalled();
    });
  });
});
