import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from './page';

vi.mock('@/features/auth/actions', () => ({ signInWithGoogle: vi.fn() }));
vi.mock('@/features/auth/components/login-form', () => ({ LoginForm: () => <div /> }));

describe('LoginPage', () => {
  it('shows a friendly message when redirected here with ?error=auth', async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ error: 'auth' }) }));
    expect(
      screen.getByText('Não foi possível concluir o login com Google. Tente novamente.')
    ).toBeInTheDocument();
  });

  it('shows no error message when there is no error param', async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.queryByText('Não foi possível concluir o login com Google. Tente novamente.')
    ).not.toBeInTheDocument();
  });
});
