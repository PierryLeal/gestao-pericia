import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUser } from './actions';
import { requireRole } from '@/features/auth/guards';

const mockCreateAuthUser = vi.fn();
const mockProfileUpdateEq = vi.fn();
const mockProfileUpdate = vi.fn(() => ({ eq: mockProfileUpdateEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { createUser: mockCreateAuthUser } },
    from: () => ({ update: mockProfileUpdate }),
  })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const validInput = { nome: 'Novo Usuário', email: 'novo@x.com', password: 'senha123', role: 'gerencia' as const };

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileUpdateEq.mockResolvedValue({ error: null });
  });

  it('creates the auth user then sets nome/role on the profile', async () => {
    mockCreateAuthUser.mockResolvedValue({ data: { user: { id: 'new-id' } }, error: null });

    const result = await createUser(validInput);

    expect(result).toEqual({ success: true, data: null });
    expect(requireRole).toHaveBeenCalledWith(['admin']);
    expect(mockCreateAuthUser).toHaveBeenCalledWith({
      email: 'novo@x.com',
      password: 'senha123',
      email_confirm: true,
    });
    expect(mockProfileUpdate).toHaveBeenCalledWith({ nome: 'Novo Usuário', role: 'gerencia' });
    expect(mockProfileUpdateEq).toHaveBeenCalledWith('id', 'new-id');
  });

  it('returns a validation error for a too-short password without calling the Auth API', async () => {
    const result = await createUser({ ...validInput, password: '123' });

    expect(result).toEqual({ success: false, error: 'Senha deve ter ao menos 6 caracteres' });
    expect(mockCreateAuthUser).not.toHaveBeenCalled();
  });

  it('returns the Auth API error message (e.g. duplicate e-mail) without touching profiles', async () => {
    mockCreateAuthUser.mockResolvedValue({ data: { user: null }, error: { message: 'User already registered' } });

    const result = await createUser(validInput);

    expect(result).toEqual({ success: false, error: 'User already registered' });
    expect(mockProfileUpdate).not.toHaveBeenCalled();
  });

  it('returns the profile-update error when it fails', async () => {
    mockCreateAuthUser.mockResolvedValue({ data: { user: { id: 'new-id' } }, error: null });
    mockProfileUpdateEq.mockResolvedValue({ error: { message: 'update failed' } });

    const result = await createUser(validInput);

    expect(result).toEqual({ success: false, error: 'update failed' });
  });
});
