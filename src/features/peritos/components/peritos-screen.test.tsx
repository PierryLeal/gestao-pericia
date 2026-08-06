import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritosScreen } from './peritos-screen';

const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockGetPerito = vi.fn();
const mockListPeritosOptions = vi.fn();
const mockMesclarPeritos = vi.fn();
vi.mock('../actions', () => ({
  createPerito: vi.fn(async (input: unknown) => ({ success: true, data: { id: 9, ...(input as object) } })),
  updatePerito: vi.fn(async (id: number, input: unknown) => ({ success: true, data: { id, ...(input as object) } })),
  deletePerito: vi.fn(),
  getPerito: (...args: unknown[]) => mockGetPerito(...args),
  listPeritosOptions: (...args: unknown[]) => mockListPeritosOptions(...args),
  mesclarPeritos: (...args: unknown[]) => mockMesclarPeritos(...args),
}));

vi.mock('@/features/pericias/actions', () => ({
  listPericiasPorPeritoIds: vi.fn(async () => []),
}));

const items = [
  {
    id: 1, nome: 'Carlos', contato: '', formacao: '', crea: '', documento: '',
    jaTrabalhamos: false, relacao: 'neutra' as const, resultados: 'parcial' as const,
  },
  {
    id: 2, nome: 'Diana', contato: '', formacao: '', crea: '', documento: '',
    jaTrabalhamos: false, relacao: 'neutra' as const, resultados: 'parcial' as const,
  },
];

describe('PeritosScreen', () => {
  it('opens the edit dialog pre-filled with the selected perito', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<PeritosScreen itemsPromise={Promise.resolve(items)} />);
    });

    await user.click(screen.getByRole('button', { name: /editar carlos/i }));

    expect(screen.getByLabelText('Nome')).toHaveValue('Carlos');
    expect(screen.getByRole('heading', { name: 'Editar perito' })).toBeInTheDocument();
  });

  it('closes the dialog and refreshes after a successful save', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<PeritosScreen itemsPromise={Promise.resolve(items)} />);
    });

    await user.click(screen.getByRole('button', { name: /novo perito/i }));
    await user.type(screen.getByLabelText('Nome'), 'Diana');
    await user.click(screen.getByRole('button', { name: /salvar perito/i }));

    expect(refresh).toHaveBeenCalled();
  });

  it('opens the merge dialog, picks the other perito, and merges on confirm', async () => {
    mockListPeritosOptions.mockResolvedValue([{ id: 1, nome: 'Carlos' }, { id: 2, nome: 'Diana' }]);
    mockGetPerito.mockResolvedValue(items[1]);
    mockMesclarPeritos.mockResolvedValue({ success: true, data: items[0] });

    const user = userEvent.setup();
    await act(async () => {
      render(<PeritosScreen itemsPromise={Promise.resolve(items)} />);
    });

    await user.click(screen.getByRole('button', { name: /mesclar carlos com outro perito/i }));
    expect(screen.getByRole('heading', { name: 'Mesclar peritos' })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /selecione um ou mais peritos/i }));
    await user.click(await screen.findByRole('option', { name: 'Diana' }));

    await user.click(await screen.findByRole('button', { name: /revisar mesclagem/i }));
    await user.click(await screen.findByRole('button', { name: /confirmar mesclagem/i }));

    expect(mockMesclarPeritos).toHaveBeenCalledWith(1, [2], expect.objectContaining({ nome: 'Carlos' }));
    expect(refresh).toHaveBeenCalled();
  });
});
