import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CreateUserForm } from './create-user-form';

const mockCreateUser = vi.fn();
vi.mock('../actions', () => ({
  createUser: (...args: unknown[]) => mockCreateUser(...args),
}));

describe('CreateUserForm', () => {
  it('submits nome/email/password/role and calls onSaved on success', async () => {
    mockCreateUser.mockResolvedValue({ success: true, data: null });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<CreateUserForm onSaved={onSaved} onError={vi.fn()} />);

    await user.type(screen.getByLabelText('Nome'), 'Novo Usuário');
    await user.type(screen.getByLabelText('E-mail'), 'novo@x.com');
    await user.type(screen.getByLabelText('Senha'), 'senha123');
    await user.click(screen.getByRole('button', { name: /criar usuário/i }));

    expect(mockCreateUser).toHaveBeenCalledWith({
      nome: 'Novo Usuário', email: 'novo@x.com', password: 'senha123', role: 'pendente',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('calls onError with the message when creation fails', async () => {
    mockCreateUser.mockResolvedValue({ success: false, error: 'User already registered' });
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<CreateUserForm onSaved={vi.fn()} onError={onError} />);

    await user.type(screen.getByLabelText('Nome'), 'Novo Usuário');
    await user.type(screen.getByLabelText('E-mail'), 'novo@x.com');
    await user.type(screen.getByLabelText('Senha'), 'senha123');
    await user.click(screen.getByRole('button', { name: /criar usuário/i }));

    expect(onError).toHaveBeenCalledWith('User already registered');
  });
});
