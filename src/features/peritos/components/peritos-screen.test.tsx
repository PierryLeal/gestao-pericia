import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritosScreen } from './peritos-screen';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../actions', () => ({
  createPerito: vi.fn(async (input: unknown) => ({ success: true, data: { id: 9, ...(input as object) } })),
  updatePerito: vi.fn(async (id: number, input: unknown) => ({ success: true, data: { id, ...(input as object) } })),
}));

const items = [{
  id: 1, nome: 'Carlos', contato: '', formacao: '', crea: '', documento: '',
  jaTrabalhamos: false, relacao: 0, resultados: 0,
}];

describe('PeritosScreen', () => {
  it('opens the edit dialog pre-filled with the selected perito', async () => {
    const user = userEvent.setup();
    render(<PeritosScreen items={items} />);

    await user.click(screen.getByRole('button', { name: /editar carlos/i }));

    expect(screen.getByLabelText('Nome')).toHaveValue('Carlos');
    expect(screen.getByRole('heading', { name: 'Editar perito' })).toBeInTheDocument();
  });

  it('closes the dialog and refreshes after a successful save', async () => {
    const user = userEvent.setup();
    render(<PeritosScreen items={items} />);

    await user.click(screen.getByRole('button', { name: /novo perito/i }));
    await user.type(screen.getByLabelText('Nome'), 'Diana');
    await user.click(screen.getByRole('button', { name: /salvar perito/i }));

    expect(refresh).toHaveBeenCalled();
  });
});
