import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LoginForm } from './login-form';

vi.mock('../actions', () => ({
  signInWithPassword: vi.fn(async () => ({ error: 'E-mail ou senha inválidos' })),
}));

describe('LoginForm', () => {
  it('shows the error returned by the sign-in action', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('E-mail'), 'admin@admin.com');
    await user.type(screen.getByLabelText('Senha'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('E-mail ou senha inválidos')).toBeInTheDocument();
  });

  it('links to the esqueci-senha page', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: /esqueci minha senha/i })).toHaveAttribute('href', '/esqueci-senha');
  });
});
