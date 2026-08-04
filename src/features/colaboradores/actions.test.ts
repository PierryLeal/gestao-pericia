import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listColaboradores, deleteColaborador } from './actions';

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
  { id: 1, nome: 'Bruna Souza', contato: '', formacao: '' },
  { id: 2, nome: 'José André', contato: '', formacao: '' },
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

describe('deleteColaborador', () => {
  beforeEach(() => {
    mockDeleteEq.mockReset();
    mockDeleteEq.mockReturnValue({ error: null });
  });

  it('deletes the colaborador', async () => {
    const result = await deleteColaborador(1);
    expect(result).toEqual({ success: true, data: null });
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 1);
  });

  it('returns the raw message on any database error', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '99999', message: 'boom' } });
    const result = await deleteColaborador(1);
    expect(result).toEqual({ success: false, error: 'boom' });
  });
});
