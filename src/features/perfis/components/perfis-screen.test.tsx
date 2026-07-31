import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerfisScreen } from './perfis-screen';

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockCreateUser = vi.fn();
vi.mock('../actions', () => ({
  createUser: (...args: unknown[]) => mockCreateUser(...args),
}));

const profiles = [{ id: '1', nome: 'Ana', email: 'ana@x.com', role: 'admin' as const }];

describe('PerfisScreen', () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    mockCreateUser.mockReset();
  });

  it('opens the dialog with the CreateUserForm when clicking "Novo usuário"', async () => {
    const user = userEvent.setup();
    render(<PerfisScreen profiles={profiles} />);

    await user.click(screen.getByRole('button', { name: /novo usuário/i }));

    expect(screen.getByRole('heading', { name: 'Novo usuário' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
  });

  it('closes the dialog and refreshes after a successful creation', async () => {
    mockCreateUser.mockResolvedValue({ success: true, data: null });
    const user = userEvent.setup();
    render(<PerfisScreen profiles={profiles} />);

    await user.click(screen.getByRole('button', { name: /novo usuário/i }));
    await user.type(screen.getByLabelText('Nome'), 'Eduardo');
    await user.type(screen.getByLabelText('E-mail'), 'eduardo@x.com');
    await user.type(screen.getByLabelText('Senha'), 'senha123');
    await user.click(screen.getByRole('button', { name: /criar usuário/i }));

    expect(mockRefresh).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Novo usuário' })).not.toBeInTheDocument();
  });

  it('keeps the dialog open and does not refresh when creation fails', async () => {
    mockCreateUser.mockResolvedValue({ success: false, error: 'E-mail já cadastrado' });
    const user = userEvent.setup();
    render(<PerfisScreen profiles={profiles} />);

    await user.click(screen.getByRole('button', { name: /novo usuário/i }));
    await user.type(screen.getByLabelText('Nome'), 'Eduardo');
    await user.type(screen.getByLabelText('E-mail'), 'eduardo@x.com');
    await user.type(screen.getByLabelText('Senha'), 'senha123');
    await user.click(screen.getByRole('button', { name: /criar usuário/i }));

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Novo usuário' })).toBeInTheDocument();
  });
});
