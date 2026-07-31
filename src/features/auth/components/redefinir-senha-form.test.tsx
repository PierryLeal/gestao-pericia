import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { RedefinirSenhaForm } from './redefinir-senha-form';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUpdateUser = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { updateUser: mockUpdateUser } }),
}));

describe('RedefinirSenhaForm', () => {
  it('updates the password via the browser client and redirects to /login on success', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<RedefinirSenhaForm />);

    await user.type(screen.getByLabelText('Nova senha'), 'novaSenha123');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'novaSenha123' });
    expect(await screen.findByText(/senha atualizada/i)).toBeInTheDocument();
  });

  it('shows an error message when updateUser fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Password too weak' } });
    const user = userEvent.setup();
    render(<RedefinirSenhaForm />);

    await user.type(screen.getByLabelText('Nova senha'), '123456');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(await screen.findByText('Password too weak')).toBeInTheDocument();
  });
});
