import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { RedefinirSenhaForm } from './redefinir-senha-form';

const mockUpdateRecoveryPassword = vi.fn();
vi.mock('../actions', () => ({
  updateRecoveryPassword: (...args: unknown[]) => mockUpdateRecoveryPassword(...args),
}));

describe('RedefinirSenhaForm', () => {
  it('updates the password via the server action and shows the success message', async () => {
    mockUpdateRecoveryPassword.mockResolvedValue({ success: true, data: null });
    const user = userEvent.setup();
    render(<RedefinirSenhaForm />);

    await user.type(screen.getByLabelText('Nova senha'), 'novaSenha123');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(mockUpdateRecoveryPassword).toHaveBeenCalledWith('novaSenha123');
    expect(await screen.findByText(/senha atualizada/i)).toBeInTheDocument();
  });

  it('shows an error message when updateRecoveryPassword fails', async () => {
    mockUpdateRecoveryPassword.mockResolvedValue({ success: false, error: 'Password too weak' });
    const user = userEvent.setup();
    render(<RedefinirSenhaForm />);

    await user.type(screen.getByLabelText('Nova senha'), '123456');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(await screen.findByText('Password too weak')).toBeInTheDocument();
  });
});
