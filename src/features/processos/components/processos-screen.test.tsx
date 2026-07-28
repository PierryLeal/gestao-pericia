import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProcessosScreen } from './processos-screen';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../actions', () => ({
  createProcesso: vi.fn(async (input: { numero: string; autor: string; reu: string }) => ({
    success: true,
    data: { id: 9, ...input },
  })),
  updateProcesso: vi.fn(async (id: number, input: { numero: string; autor: string; reu: string }) => ({
    success: true,
    data: { id, ...input },
  })),
}));

const items = [{ id: 1, numero: 'P-1', autor: 'Ana', reu: 'Bia' }];

describe('ProcessosScreen', () => {
  it('opens the create dialog and saves a new processo', async () => {
    const user = userEvent.setup();
    render(<ProcessosScreen items={items} />);

    await user.click(screen.getByRole('button', { name: /novo processo/i }));
    await user.type(screen.getByLabelText('Número do processo'), 'P-2');
    await user.type(screen.getByLabelText('Autor'), 'Carla');
    await user.type(screen.getByLabelText('Réu'), 'Davi');
    await user.click(screen.getByRole('button', { name: /salvar processo/i }));

    expect(refresh).toHaveBeenCalled();
  });

  it('opens the edit dialog pre-filled with the selected processo', async () => {
    const user = userEvent.setup();
    render(<ProcessosScreen items={items} />);

    await user.click(screen.getByRole('button', { name: /editar p-1/i }));

    expect(screen.getByLabelText('Número do processo')).toHaveValue('P-1');
    expect(screen.getByRole('heading', { name: 'Editar processo' })).toBeInTheDocument();
  });
});
