import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColaboradorForm } from './colaborador-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('../actions', () => ({
  createColaborador: vi.fn(async () => ({ success: false, error: 'Nome é obrigatório' })),
}));

describe('ColaboradorForm', () => {
  it('shows the error returned by the action when validation fails', async () => {
    const user = userEvent.setup();
    render(<ColaboradorForm />);

    await user.click(screen.getByRole('button', { name: /salvar colaborador/i }));

    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
  });
});
