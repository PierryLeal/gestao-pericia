import { describe, it, expect, vi } from 'vitest';
import { requestPasswordReset } from './actions';

const mockResetPasswordForEmail = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { resetPasswordForEmail: mockResetPasswordForEmail },
  })),
}));

describe('requestPasswordReset', () => {
  it('calls resetPasswordForEmail with the given e-mail and the redefinir-senha redirect', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    await requestPasswordReset('alguem@x.com');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('alguem@x.com', {
      redirectTo: 'https://example.com/redefinir-senha',
    });
  });
});
