import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MesclarColaboradorDialog } from './mesclar-colaborador-dialog';

const mockGetColaborador = vi.fn();
const mockListColaboradoresOptions = vi.fn();
const mockMesclarColaboradores = vi.fn();
vi.mock('../actions', () => ({
  getColaborador: (...args: unknown[]) => mockGetColaborador(...args),
  listColaboradoresOptions: (...args: unknown[]) => mockListColaboradoresOptions(...args),
  mesclarColaboradores: (...args: unknown[]) => mockMesclarColaboradores(...args),
}));

const mockListPericiasPorColaboradorIds = vi.fn();
vi.mock('@/features/pericias/actions', () => ({
  listPericiasPorColaboradorIds: (...args: unknown[]) => mockListPericiasPorColaboradorIds(...args),
}));

const joao = { id: 1, nome: 'João', contato: '31999990000', formacao: '', email: null };
const joao2 = { id: 2, nome: 'João 2', contato: '', formacao: 'Direito', email: 'joao2@exemplo.com' };

async function abrirEEscolherJoao2() {
  mockListColaboradoresOptions.mockResolvedValue([{ id: 1, nome: 'João' }, { id: 2, nome: 'João 2' }]);
  mockGetColaborador.mockResolvedValue(joao2);
  mockListPericiasPorColaboradorIds.mockResolvedValue([]);
  const user = userEvent.setup();
  await act(async () => {
    render(
      <MesclarColaboradorDialog colaboradorA={joao} open onOpenChange={vi.fn()} onMerged={vi.fn()} />
    );
  });
  await user.click(screen.getByRole('combobox', { name: /selecione um ou mais colaboradores/i }));
  await user.click(await screen.findByRole('option', { name: 'João 2' }));
  return user;
}

describe('MesclarColaboradorDialog', () => {
  it('keeps a manually edited field when switching "quem fica" to another candidate and back', async () => {
    const user = await abrirEEscolherJoao2();

    // Still on João (the default survivor): manually correct the formação,
    // which only João 2 actually has right.
    const formacaoInput = screen.getByLabelText('Formação');
    await user.clear(formacaoInput);
    await user.type(formacaoInput, 'Direito');

    // Switch to João 2 — untouched fields (nome) follow João 2, but the
    // manually edited formação must NOT be clobbered by João 2's own value.
    await user.click(screen.getByRole('button', { name: 'João 2' }));
    expect(screen.getByLabelText('Formação')).toHaveValue('Direito');

    // Switch back to João — same expectation.
    await user.click(screen.getByRole('button', { name: 'João' }));
    expect(screen.getByLabelText('Formação')).toHaveValue('Direito');
    // The untouched contato field still follows whichever candidate is selected.
    expect(screen.getByLabelText('Contato')).toHaveValue('(31) 99999-0000');
  });

  it('shows an "editado" badge next to a manually edited field and not on untouched ones', async () => {
    const user = await abrirEEscolherJoao2();

    expect(screen.queryByText('editado')).not.toBeInTheDocument();

    const emailInput = screen.getByLabelText('E-mail');
    await user.clear(emailInput);
    await user.type(emailInput, 'novo@exemplo.com');

    expect(screen.getByText('editado')).toBeInTheDocument();
  });

  it('shows a preview of the affected perícias before confirming, and sends the combined values on confirm', async () => {
    const user = await abrirEEscolherJoao2();
    mockListPericiasPorColaboradorIds.mockResolvedValue([
      {
        id: 10, processoNumero: '0001234-56.2026', dataAgendada: '2026-08-10', horaAgendada: '09:00:00',
        situacao: 'marcada', donoAtual: 'João 2',
      },
    ]);
    mockMesclarColaboradores.mockResolvedValue({ success: true, data: joao });

    const formacaoInput = screen.getByLabelText('Formação');
    await user.clear(formacaoInput);
    await user.type(formacaoInput, 'Direito');

    await user.click(screen.getByRole('button', { name: /revisar mesclagem/i }));

    expect(mockListPericiasPorColaboradorIds).toHaveBeenCalledWith([2]);
    expect(await screen.findByText('0001234-56.2026')).toBeInTheDocument();
    expect(screen.getByText(/1 perícia será reatribuída/i)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /confirmar mesclagem/i }));

    expect(mockMesclarColaboradores).toHaveBeenCalledWith(
      1, [2],
      { nome: 'João', contato: '(31) 99999-0000', formacao: 'Direito', email: '' }
    );
  });

  it('lets the user go back from the preview to keep editing before confirming', async () => {
    const user = await abrirEEscolherJoao2();

    await user.click(screen.getByRole('button', { name: /revisar mesclagem/i }));
    expect(await screen.findByText(/nenhuma perícia será afetada/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(screen.getByRole('button', { name: /revisar mesclagem/i })).toBeInTheDocument();
    expect(screen.queryByText(/nenhuma perícia será afetada/i)).not.toBeInTheDocument();
  });
});
