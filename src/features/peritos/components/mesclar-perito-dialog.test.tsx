import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MesclarPeritoDialog } from './mesclar-perito-dialog';

const mockGetPerito = vi.fn();
const mockListPeritosOptions = vi.fn();
const mockMesclarPeritos = vi.fn();
vi.mock('../actions', () => ({
  getPerito: (...args: unknown[]) => mockGetPerito(...args),
  listPeritosOptions: (...args: unknown[]) => mockListPeritosOptions(...args),
  mesclarPeritos: (...args: unknown[]) => mockMesclarPeritos(...args),
}));

const mockListPericiasPorPeritoIds = vi.fn();
vi.mock('@/features/pericias/actions', () => ({
  listPericiasPorPeritoIds: (...args: unknown[]) => mockListPericiasPorPeritoIds(...args),
}));

const carlos = {
  id: 1, nome: 'Carlos', contato: '31999990000', formacao: '', crea: '', documento: '',
  jaTrabalhamos: false, relacao: 'neutra' as const, resultados: 'parcial' as const,
};
const carlos2 = {
  id: 2, nome: 'Carlos 2', contato: '', formacao: 'Direito', crea: 'CREA-99', documento: '',
  jaTrabalhamos: true, relacao: 'otima' as const, resultados: 'positivo' as const,
};

async function abrirEEscolherCarlos2() {
  mockListPeritosOptions.mockResolvedValue([{ id: 1, nome: 'Carlos' }, { id: 2, nome: 'Carlos 2' }]);
  mockGetPerito.mockResolvedValue(carlos2);
  mockListPericiasPorPeritoIds.mockResolvedValue([]);
  const user = userEvent.setup();
  await act(async () => {
    render(<MesclarPeritoDialog peritoA={carlos} open onOpenChange={vi.fn()} onMerged={vi.fn()} />);
  });
  await user.click(screen.getByRole('combobox', { name: /selecione um ou mais peritos/i }));
  await user.click(await screen.findByRole('option', { name: 'Carlos 2' }));
  return user;
}

describe('MesclarPeritoDialog', () => {
  it('keeps a manually edited field when switching "quem fica" to another candidate and back', async () => {
    const user = await abrirEEscolherCarlos2();

    const formacaoInput = screen.getByLabelText('Formação');
    await user.clear(formacaoInput);
    await user.type(formacaoInput, 'Engenharia Mecânica');

    await user.click(screen.getByRole('button', { name: 'Carlos 2' }));
    expect(screen.getByLabelText('Formação')).toHaveValue('Engenharia Mecânica');

    await user.click(screen.getByRole('button', { name: 'Carlos' }));
    expect(screen.getByLabelText('Formação')).toHaveValue('Engenharia Mecânica');
    // Untouched contato still follows whichever candidate is currently selected (back to Carlos's own).
    expect(screen.getByLabelText('Contato')).toHaveValue('(31) 99999-0000');
  });

  it('shows an "editado" badge only for fields edited manually', async () => {
    await abrirEEscolherCarlos2();
    expect(screen.queryByText('editado')).not.toBeInTheDocument();
  });

  it('shows a preview of the affected perícias before confirming, and sends the combined values on confirm', async () => {
    const user = await abrirEEscolherCarlos2();
    mockListPericiasPorPeritoIds.mockResolvedValue([
      {
        id: 20, processoNumero: '0009876-12.2026', dataAgendada: '2026-09-01', horaAgendada: '14:00:00',
        situacao: 'pendente', donoAtual: 'Carlos 2',
      },
    ]);
    mockMesclarPeritos.mockResolvedValue({ success: true, data: carlos });

    const formacaoInput = screen.getByLabelText('Formação');
    await user.clear(formacaoInput);
    await user.type(formacaoInput, 'Direito');

    await user.click(screen.getByRole('button', { name: /revisar mesclagem/i }));

    expect(mockListPericiasPorPeritoIds).toHaveBeenCalledWith([2]);
    expect(await screen.findByText('0009876-12.2026')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /confirmar mesclagem/i }));

    expect(mockMesclarPeritos).toHaveBeenCalledWith(1, [2], {
      nome: 'Carlos', contato: '(31) 99999-0000', formacao: 'Direito', crea: '', documento: '',
      jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial',
    });
  });

  it('lets the user go back from the preview to keep editing before confirming', async () => {
    const user = await abrirEEscolherCarlos2();

    await user.click(screen.getByRole('button', { name: /revisar mesclagem/i }));
    expect(await screen.findByText(/nenhuma perícia será afetada/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(screen.getByRole('button', { name: /revisar mesclagem/i })).toBeInTheDocument();
  });
});
