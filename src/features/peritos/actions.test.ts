import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPeritos } from './actions';

const mockOrder = vi.fn();
const mockIlike = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ order: mockOrder, ilike: mockIlike }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect }),
  })),
}));

describe('listPeritos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by nome when busca is provided', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    await listPeritos('Carlos');
    expect(mockIlike).toHaveBeenCalledWith('nome', '%Carlos%');
  });

  it('does not filter when busca is empty', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    await listPeritos();
    expect(mockIlike).not.toHaveBeenCalled();
  });
});
