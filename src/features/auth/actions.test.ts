import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestPasswordReset, updateRecoveryPassword } from './actions';

const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
    },
  })),
}));

describe('requestPasswordReset', () => {
  it('calls resetPasswordForEmail with the given e-mail and the auth callback redirect', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    await requestPasswordReset('alguem@x.com');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('alguem@x.com', {
      redirectTo: 'https://example.com/auth/callback?next=/redefinir-senha',
    });
  });
});

describe('updateRecoveryPassword', () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockSignOut.mockReset();
  });

  it('updates the password and signs the user out on success', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const result = await updateRecoveryPassword('novaSenha123');

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'novaSenha123' });
    expect(mockSignOut).toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: null });
  });

  it('returns the error and does not sign out on failure', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Password too weak' } });

    const result = await updateRecoveryPassword('123456');

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: 'Password too weak' });
  });
});
