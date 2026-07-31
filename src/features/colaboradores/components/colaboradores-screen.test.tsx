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

vi.mock('../actions', () => ({
  createColaborador: vi.fn(async (input: unknown) => ({ success: true, data: { id: 9, ...(input as object) } })),
  updateColaborador: vi.fn(async (id: number, input: unknown) => ({ success: true, data: { id, ...(input as object) } })),
  deleteColaborador: vi.fn(async () => ({ success: true, data: null })),
}));

const items = [{ id: 1, nome: 'Bruna', contato: '', formacao: '', interno: true }];

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
});
