import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeuPerfilScreen } from './meu-perfil-screen';

const mockUpdateOwnNome = vi.fn();
const mockUpdateOwnPassword = vi.fn();
vi.mock('../actions', () => ({
  updateOwnNome: (...args: unknown[]) => mockUpdateOwnNome(...args),
  updateOwnPassword: (...args: unknown[]) => mockUpdateOwnPassword(...args),
}));

const profile = { id: 'u1', nome: 'Ana Souza', email: 'ana@x.com', role: 'gerencia' as const };

describe('MeuPerfilScreen', () => {
  beforeEach(() => {
    mockUpdateOwnNome.mockClear();
    mockUpdateOwnPassword.mockClear();
  });
  it('submits the nome form independently from the password form', async () => {
    mockUpdateOwnNome.mockResolvedValue({ success: true, data: null });
    const user = userEvent.setup();
    render(<MeuPerfilScreen profile={profile} />);

    const nomeInput = screen.getByLabelText('Nome');
    await user.clear(nomeInput);
    await user.type(nomeInput, 'Ana Nova');
    await user.click(screen.getByRole('button', { name: /salvar nome/i }));

    expect(mockUpdateOwnNome).toHaveBeenCalledWith('Ana Nova');
    expect(mockUpdateOwnPassword).not.toHaveBeenCalled();
    expect(await screen.findByText('Nome atualizado')).toBeInTheDocument();
  });

  it('submits the password form independently from the nome form', async () => {
    mockUpdateOwnPassword.mockResolvedValue({ success: true, data: null });
    const user = userEvent.setup();
    render(<MeuPerfilScreen profile={profile} />);

    await user.type(screen.getByLabelText('Nova senha'), 'novaSenha123');
    await user.click(screen.getByRole('button', { name: /salvar senha/i }));

    expect(mockUpdateOwnPassword).toHaveBeenCalledWith('novaSenha123');
    expect(mockUpdateOwnNome).not.toHaveBeenCalled();
    expect(await screen.findByText('Senha atualizada')).toBeInTheDocument();
  });
});
