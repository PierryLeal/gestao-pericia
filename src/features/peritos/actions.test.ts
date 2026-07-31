import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPeritos, deletePerito } from './actions';

const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockDeleteEq = vi.fn();
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect, delete: mockDelete }),
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

describe('deletePerito', () => {
  beforeEach(() => {
    mockDeleteEq.mockReset();
    mockDeleteEq.mockReturnValue({ error: null });
  });

  it('deletes the perito', async () => {
    const result = await deletePerito(1);
    expect(result).toEqual({ success: true, data: null });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 1);
  });

  it('returns a friendly error when the perito has linked pericias', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '23503', message: 'foreign key violation' } });
    const result = await deletePerito(1);
    expect(result).toEqual({
      success: false,
      error: 'Não é possível excluir: há perícias vinculadas a este perito.',
    });
  });

  it('returns the raw message for any other error', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '99999', message: 'boom' } });
    const result = await deletePerito(1);
    expect(result).toEqual({ success: false, error: 'boom' });
  });
});
