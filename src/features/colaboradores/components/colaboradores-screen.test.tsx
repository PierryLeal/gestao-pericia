import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColaboradoresScreen } from './colaboradores-screen';

const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockGetColaborador = vi.fn();
const mockListColaboradoresOptions = vi.fn();
const mockMesclarColaboradores = vi.fn();
vi.mock('../actions', () => ({
  createColaborador: vi.fn(async (input: unknown) => ({ success: true, data: { id: 9, ...(input as object) } })),
  updateColaborador: vi.fn(async (id: number, input: unknown) => ({ success: true, data: { id, ...(input as object) } })),
  deleteColaborador: vi.fn(async () => ({ success: true, data: null })),
  getColaborador: (...args: unknown[]) => mockGetColaborador(...args),
  listColaboradoresOptions: (...args: unknown[]) => mockListColaboradoresOptions(...args),
  mesclarColaboradores: (...args: unknown[]) => mockMesclarColaboradores(...args),
}));

vi.mock('@/features/pericias/actions', () => ({
  listPericiasPorColaboradorIds: vi.fn(async () => []),
}));

const items = [
  { id: 1, nome: 'Bruna', contato: '', formacao: '', email: null },
  { id: 2, nome: 'Eduardo', contato: '', formacao: '', email: null },
  { id: 3, nome: 'Carla', contato: '', formacao: '', email: null },
];

describe('ColaboradoresScreen', () => {
  it('opens the edit dialog pre-filled with the selected colaborador', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<ColaboradoresScreen itemsPromise={Promise.resolve(items)} />);
    });

    await user.click(screen.getByRole('button', { name: /editar bruna/i }));

    expect(screen.getByLabelText('Nome')).toHaveValue('Bruna');
    expect(screen.getByRole('heading', { name: 'Editar colaborador' })).toBeInTheDocument();
  });

  it('closes the dialog and refreshes after a successful save', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<ColaboradoresScreen itemsPromise={Promise.resolve(items)} />);
    });

    await user.click(screen.getByRole('button', { name: /novo colaborador/i }));
    await user.type(screen.getByLabelText('Nome'), 'Eduardo');
    await user.click(screen.getByRole('button', { name: /salvar colaborador/i }));

    expect(refresh).toHaveBeenCalled();
  });

  it('opens the merge dialog, picks the other colaborador, and merges on confirm', async () => {
    mockListColaboradoresOptions.mockResolvedValue([
      { id: 1, nome: 'Bruna' }, { id: 2, nome: 'Eduardo' }, { id: 3, nome: 'Carla' },
    ]);
    mockGetColaborador.mockResolvedValue({ id: 2, nome: 'Eduardo', contato: '', formacao: '', email: null });
    mockMesclarColaboradores.mockResolvedValue({
      success: true, data: { id: 1, nome: 'Bruna', contato: '', formacao: '', email: null },
    });

    const user = userEvent.setup();
    await act(async () => {
      render(<ColaboradoresScreen itemsPromise={Promise.resolve(items)} />);
    });

    await user.click(screen.getByRole('button', { name: /mesclar bruna com outro colaborador/i }));
    expect(screen.getByRole('heading', { name: 'Mesclar colaboradores' })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /selecione um ou mais colaboradores/i }));
    await user.click(await screen.findByRole('option', { name: 'Eduardo' }));

    await user.click(await screen.findByRole('button', { name: /revisar mesclagem/i }));
    await user.click(await screen.findByRole('button', { name: /confirmar mesclagem/i }));

    expect(mockMesclarColaboradores).toHaveBeenCalledWith(1, [2], expect.objectContaining({ nome: 'Bruna' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('merges three or more colaboradores at once when multiple are selected', async () => {
    mockListColaboradoresOptions.mockResolvedValue([
      { id: 1, nome: 'Bruna' }, { id: 2, nome: 'Eduardo' }, { id: 3, nome: 'Carla' },
    ]);
    mockGetColaborador.mockImplementation(async (id: number) =>
      items.find((item) => item.id === id) ?? null
    );
    mockMesclarColaboradores.mockResolvedValue({
      success: true, data: { id: 1, nome: 'Bruna', contato: '', formacao: '', email: null },
    });

    const user = userEvent.setup();
    await act(async () => {
      render(<ColaboradoresScreen itemsPromise={Promise.resolve(items)} />);
    });

    await user.click(screen.getByRole('button', { name: /mesclar bruna com outro colaborador/i }));
    await user.click(screen.getByRole('combobox', { name: /selecione um ou mais colaboradores/i }));
    await user.click(await screen.findByRole('option', { name: 'Eduardo' }));
    await user.click(await screen.findByRole('option', { name: 'Carla' }));

    expect(await screen.findByText('Eduardo', { selector: 'span' })).toBeInTheDocument();
    expect(await screen.findByText('Carla', { selector: 'span' })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /revisar mesclagem/i }));
    await user.click(await screen.findByRole('button', { name: /confirmar mesclagem/i }));

    expect(mockMesclarColaboradores).toHaveBeenCalledWith(1, [2, 3], expect.objectContaining({ nome: 'Bruna' }));
    expect(refresh).toHaveBeenCalled();
  });
});
