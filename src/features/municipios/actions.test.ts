import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertMunicipio } from './actions';

const mockUpsert = vi.fn();

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ upsert: mockUpsert }),
  })),
}));

describe('upsertMunicipio', () => {
  beforeEach(() => mockUpsert.mockReset());

  it('upserts a valid municipio and returns it', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const result = await upsertMunicipio({ id: 3550308, nome: 'São Paulo', uf: 'SP' });
    expect(result).toEqual({ id: 3550308, nome: 'São Paulo', uf: 'SP' });
    expect(mockUpsert).toHaveBeenCalledWith({ id: 3550308, nome: 'São Paulo', uf: 'SP' });
  });

  it('throws when the upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'db error' } });
    await expect(upsertMunicipio({ id: 1, nome: 'X', uf: 'SP' })).rejects.toThrow('db error');
  });
});
