import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPeritos } from './actions';

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
  {
    id: 1, nome: 'Carlos Lima', contato: '', formacao: '', crea: '', documento: '',
    ja_trabalhamos: false, relacao: 'neutra' as const, resultados: 'parcial' as const,
  },
  {
    id: 2, nome: 'André Simões', contato: '', formacao: '', crea: '', documento: '',
    ja_trabalhamos: false, relacao: 'neutra' as const, resultados: 'parcial' as const,
  },
];

describe('listPeritos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by nome when busca is provided', async () => {
    mockOrder.mockResolvedValue({ data: rows, error: null });
    const result = await listPeritos('Carlos');
    expect(result.map((p) => p.id)).toEqual([1]);
  });

  it('matches accent-insensitively (e.g. "andre" matches "André")', async () => {
    mockOrder.mockResolvedValue({ data: rows, error: null });
    const result = await listPeritos('andre');
    expect(result.map((p) => p.id)).toEqual([2]);
  });

  it('does not filter when busca is empty', async () => {
    mockOrder.mockResolvedValue({ data: rows, error: null });
    const result = await listPeritos();
    expect(result.map((p) => p.id)).toEqual([1, 2]);
  });
});
