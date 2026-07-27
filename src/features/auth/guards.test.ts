import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentProfile, requireRole } from './guards';

const mockGetUser = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  })),
}));

describe('getCurrentProfile', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockSingle.mockReset();
  });

  it('returns null when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const profile = await getCurrentProfile();
    expect(profile).toBeNull();
  });

  it('returns the profile row for an authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({ data: { id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'admin' } });
    const profile = await getCurrentProfile();
    expect(profile).toEqual({ id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'admin' });
  });
});

describe('requireRole', () => {
  it('throws UNAUTHENTICATED when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(requireRole(['admin'])).rejects.toThrow('UNAUTHENTICATED');
  });

  it('throws FORBIDDEN when the role is not allowed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({ data: { id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'gerencia' } });
    await expect(requireRole(['admin'])).rejects.toThrow('FORBIDDEN');
  });

  it('resolves with the profile when the role is allowed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({ data: { id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'admin' } });
    const profile = await requireRole(['admin', 'gerencia']);
    expect(profile.id).toBe('u1');
  });
});
