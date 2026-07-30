import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listColaboradores } from './actions';

const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect }),
  })),
}));

const rows = [
  { id: 1, nome: 'Bruna Souza', contato: '', formacao: '', interno: true },
  { id: 2, nome: 'José André', contato: '', formacao: '', interno: false },
];

describe('listColaboradores', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by nome when busca is provided', async () => {
    mockOrder.mockResolvedValue({ data: rows, error: null });
    const result = await listColaboradores('Bruna');
    expect(result).toEqual([rows[0]]);
  });

  it('matches accent-insensitively (e.g. "jose andre" matches "José André")', async () => {
    mockOrder.mockResolvedValue({ data: rows, error: null });
    const result = await listColaboradores('jose andre');
    expect(result).toEqual([rows[1]]);
  });

  it('does not filter when busca is empty', async () => {
    mockOrder.mockResolvedValue({ data: rows, error: null });
    const result = await listColaboradores();
    expect(result).toEqual(rows);
  });
});
