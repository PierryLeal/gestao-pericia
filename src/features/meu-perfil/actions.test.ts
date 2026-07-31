import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateOwnNome, updateOwnPassword } from './actions';

const mockRpc = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'gerencia' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
    auth: { updateUser: mockUpdateUser },
  })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

describe('updateOwnNome', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the update_own_nome RPC with the new name', async () => {
    mockRpc.mockResolvedValue({ error: null });
    const result = await updateOwnNome('Novo Nome');
    expect(result).toEqual({ success: true, data: null });
    expect(mockRpc).toHaveBeenCalledWith('update_own_nome', { new_nome: 'Novo Nome' });
  });

  it('rejects an empty name without calling the RPC', async () => {
    const result = await updateOwnNome('');
    expect(result).toEqual({ success: false, error: 'Nome é obrigatório' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns the RPC error message on failure', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'boom' } });
    const result = await updateOwnNome('Novo Nome');
    expect(result).toEqual({ success: false, error: 'boom' });
  });
});

describe('updateOwnPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls auth.updateUser with the new password', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    const result = await updateOwnPassword('novaSenha123');
    expect(result).toEqual({ success: true, data: null });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'novaSenha123' });
  });

  it('rejects a too-short password without calling the Auth API', async () => {
    const result = await updateOwnPassword('123');
    expect(result).toEqual({ success: false, error: 'Senha deve ter ao menos 6 caracteres' });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('returns the Auth error message on failure', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'weak password' } });
    const result = await updateOwnPassword('novaSenha123');
    expect(result).toEqual({ success: false, error: 'weak password' });
  });
});
