import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritoForm } from './perito-form';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

vi.mock('../actions', () => ({
  createPerito: vi.fn(async () => ({ success: false, error: 'Nome é obrigatório' })),
}));

describe('PeritoForm', () => {
  it('shows the error returned by the action when validation fails', async () => {
    const user = userEvent.setup();
    render(<PeritoForm />);

    await user.click(screen.getByRole('button', { name: /salvar perito/i }));

    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
  });
});
