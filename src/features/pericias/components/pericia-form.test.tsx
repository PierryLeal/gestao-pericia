import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PericiaForm } from './pericia-form';
import { createPericia, getColaboradoresIndisponiveis } from '../actions';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';

vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  getColaboradoresIndisponiveis: vi.fn(async () => []),
}));

vi.mock('@/features/processos/components/processo-combobox', () => ({
  ProcessoCombobox: ({ onChange }: { onChange: (p: Processo) => void }) => (
    <button type="button" onClick={() => onChange({ id: 1, numero: 'P-1', autor: 'A', reu: 'B' })}>
      selecionar processo
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
  beforeEach(() => vi.clearAllMocks());

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

    expect(getColaboradoresIndisponiveis).toHaveBeenCalledWith('2026-08-10', '14:00', undefined);

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    const busyOption = await screen.findByRole('option', { name: 'Bruna' });
    expect(busyOption.className).toMatch(/opacity-40/);
    await user.click(busyOption);

    expect(
      await screen.findByText('Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar perícia/i })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
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
      await screen.findByText('Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.')
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
      screen.queryByText('Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.')
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
          colaboradorId: 2,
          dataAgendada: '2026-08-10',
          horaAgendada: '14:00',
          situacao: 'marcada',
          observacoes: null,
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

    expect(getColaboradoresIndisponiveis).toHaveBeenCalledWith('2026-08-10', '14:00', 9);
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
    expect(getColaboradoresIndisponiveis).toHaveBeenNthCalledWith(1, '2026-08-10', '14:00', undefined);
    expect(getColaboradoresIndisponiveis).toHaveBeenNthCalledWith(2, '2026-08-10', '15:00', undefined);

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
});
